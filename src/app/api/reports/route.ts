import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validations/message";

/**
 * POST /api/reports
 * Report a message or jam session (R32).
 * Body: { messageId?: string, jamId?: string, reason: string }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reporterId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const { messageId, jamId, reason } = parsed.data;

  // If reporting a message, verify it exists
  if (messageId) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true },
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 },
      );
    }
  }

  // If reporting a jam, verify it exists
  if (jamId) {
    const jam = await prisma.jamSession.findUnique({
      where: { id: jamId },
      select: { id: true },
    });

    if (!jam) {
      return NextResponse.json(
        { error: "Jam session not found" },
        { status: 404 },
      );
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      messageId: messageId ?? null,
      jamId: jamId ?? null,
      reason,
    },
  });

  return NextResponse.json(
    {
      report: {
        id: report.id,
        reporterId: report.reporterId,
        messageId: report.messageId,
        jamId: report.jamId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
