import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockSchema } from "@/lib/validations/message";

/**
 * POST /api/blocks
 * Block a user (R31). Both users must have profiles.
 * Body: { userId: string } — the userId to block.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blockerId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = blockSchema.safeParse(body);
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

  const blockedUserId = parsed.data.userId;

  // Cannot block self
  if (blockedUserId === blockerId) {
    return NextResponse.json(
      { error: "Cannot block yourself" },
      { status: 400 },
    );
  }

  // Check target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: blockedUserId },
    select: { id: true },
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already blocked
  const existing = await prisma.block.findUnique({
    where: {
      userId_blockedUserId: {
        userId: blockerId,
        blockedUserId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ blocked: true, alreadyBlocked: true });
  }

  await prisma.block.create({
    data: {
      userId: blockerId,
      blockedUserId,
    },
  });

  return NextResponse.json({ blocked: true }, { status: 201 });
}

/**
 * DELETE /api/blocks
 * Unblock a user.
 * Body: { userId: string } — the userId to unblock.
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blockerId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = blockSchema.safeParse(body);
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

  const blockedUserId = parsed.data.userId;

  try {
    await prisma.block.delete({
      where: {
        userId_blockedUserId: {
          userId: blockerId,
          blockedUserId,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ unblocked: true });
}
