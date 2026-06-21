import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clipId } = await params;
  const userId = session.user.id;

  // Find clip and verify ownership via profile
  const clip = await prisma.audioClip.findUnique({
    where: { id: clipId },
    include: {
      profile: {
        select: { userId: true },
      },
    },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (clip.profile.userId !== userId) {
    return NextResponse.json(
      { error: "Forbidden: only the clip owner can delete it" },
      { status: 403 },
    );
  }

  // Delete in transaction: comments first, then clip.
  // Note: Prisma schema has onDelete: Cascade on ClipComment, but explicit delete
  // ensures we handle it cleanly even if cascade is missing in some providers.
  await prisma.$transaction([
    prisma.clipComment.deleteMany({ where: { clipId } }),
    prisma.audioClip.delete({ where: { id: clipId } }),
  ]);

  // TODO: Optionally delete R2 objects (original + transcoded) here.
  // For MVP, we keep files in R2 to avoid accidental data loss.

  return NextResponse.json({ deleted: true });
}
