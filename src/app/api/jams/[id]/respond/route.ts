import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jamResponseSchema } from "@/lib/validations/jam";

/**
 * POST /api/jams/[id]/respond
 * Respond to a jam session: "interested" or "going" (R36).
 * Authenticated users only. One response per user per jam.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jamId } = await params;
  const userId = session.user.id;

  // Validate jam exists and is active
  const jam = await prisma.jamSession.findUnique({
    where: { id: jamId },
    select: { id: true, status: true, dateTime: true },
  });

  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  if (jam.status !== "active") {
    return NextResponse.json(
      { error: `Cannot respond to a ${jam.status} jam` },
      { status: 400 },
    );
  }

  if (new Date(jam.dateTime) <= new Date()) {
    return NextResponse.json(
      { error: "Cannot respond to a past jam session" },
      { status: 400 },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jamResponseSchema.safeParse(body);
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

  const { response } = parsed.data;

  // Check existing response (upsert pattern — one response per user per jam)
  const existing = await prisma.jamResponse.findUnique({
    where: {
      jamId_userId: { jamId, userId },
    },
  });

  if (existing) {
    // Update existing response
    const updated = await prisma.jamResponse.update({
      where: { id: existing.id },
      data: { response },
      include: {
        responder: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      response: {
        id: updated.id,
        jamId: updated.jamId,
        response: updated.response,
        createdAt: updated.createdAt.toISOString(),
        responder: {
          id: updated.responder.id,
          name: updated.responder.name,
          avatarUrl: updated.responder.avatarUrl,
        },
      },
    });
  }

  // Create new response
  const created = await prisma.jamResponse.create({
    data: {
      jamId,
      userId,
      response,
    },
    include: {
      responder: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      response: {
        id: created.id,
        jamId: created.jamId,
        response: created.response,
        createdAt: created.createdAt.toISOString(),
        responder: {
          id: created.responder.id,
          name: created.responder.name,
          avatarUrl: created.responder.avatarUrl,
        },
      },
    },
    { status: 201 },
  );
}
