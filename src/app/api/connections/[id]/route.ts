import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectionResponseSchema } from "@/lib/validations/connection";

/**
 * PATCH /api/connections/[id]
 * Accept or decline a connection request.
 * Only the receiver can accept/decline.
 * Body: { action: "accept" | "decline" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: connectionId } = await params;

  // Get the user's profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Find the connection
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // Only the receiver can accept/decline
  if (connection.receiverId !== profile.id) {
    return NextResponse.json(
      { error: "Only the receiver can accept or decline" },
      { status: 403 },
    );
  }

  if (connection.status !== "pending") {
    return NextResponse.json(
      { error: `Connection is already ${connection.status}` },
      { status: 409 },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = connectionResponseSchema.safeParse(body);
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

  const { action } = parsed.data;
  const newStatus = action === "accept" ? "accepted" : "declined";

  const updated = await prisma.connection.update({
    where: { id: connectionId },
    data: { status: newStatus },
  });

  return NextResponse.json({
    connection: {
      id: updated.id,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

/**
 * DELETE /api/connections/[id]
 * Remove an existing connection (either direction).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: connectionId } = await params;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (
    connection.requesterId !== profile.id &&
    connection.receiverId !== profile.id
  ) {
    return NextResponse.json({ error: "Not your connection" }, { status: 403 });
  }

  await prisma.connection.delete({ where: { id: connectionId } });

  return NextResponse.json({ deleted: true });
}
