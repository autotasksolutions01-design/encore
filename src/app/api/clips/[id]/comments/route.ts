import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clipCommentSchema } from "@/lib/validations/clip";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clipId } = await params;

  // Verify clip exists
  const clip = await prisma.audioClip.findUnique({
    where: { id: clipId },
    select: { id: true, profileId: true },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  const comments = await prisma.clipComment.findMany({
    where: { clipId },
    select: {
      id: true,
      text: true,
      createdAt: true,
      authorId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clipId } = await params;
  const userId = session.user.id;

  // Verify clip exists
  const clip = await prisma.audioClip.findUnique({
    where: { id: clipId },
    select: { id: true, profileId: true },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = clipCommentSchema.safeParse(body);
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

  const comment = await prisma.clipComment.create({
    data: {
      clipId,
      authorId: userId,
      text: parsed.data.text,
    },
    select: {
      id: true,
      text: true,
      createdAt: true,
      authorId: true,
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
