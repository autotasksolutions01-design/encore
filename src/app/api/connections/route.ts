import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectionSchema } from "@/lib/validations/connection";

/**
 * GET /api/connections
 * Returns all connections for the authenticated user's profile.
 * Query params:
 *   - status: "pending" | "accepted" (optional, defaults to all)
 *   - type: "received" | "sent" (optional, defaults to all)
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const typeFilter = url.searchParams.get("type");

  // Get the user's profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const profileId = profile.id;

  // Build where clause
  const conditions: Array<Record<string, unknown>> = [];

  if (typeFilter === "received") {
    conditions.push({ receiverId: profileId });
  } else if (typeFilter === "sent") {
    conditions.push({ requesterId: profileId });
  } else {
    conditions.push({
      OR: [{ requesterId: profileId }, { receiverId: profileId }],
    });
  }

  if (
    statusFilter === "pending" ||
    statusFilter === "accepted" ||
    statusFilter === "declined"
  ) {
    conditions.push({ status: statusFilter });
  }

  // Combine all conditions with AND
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any =
    conditions.length === 1
      ? conditions[0]
      : { AND: conditions };

  const connections = await prisma.connection.findMany({
    where,
    include: {
      requester: {
        select: {
          id: true,
          displayName: true,
          city: true,
          skillLevel: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          displayName: true,
          city: true,
          skillLevel: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = connections.map((conn) => ({
    id: conn.id,
    status: conn.status,
    createdAt: conn.createdAt.toISOString(),
    requester: {
      id: conn.requester.id,
      displayName: conn.requester.displayName,
      city: conn.requester.city,
      skillLevel: conn.requester.skillLevel,
      instruments: conn.requester.instruments.map((i) => i.instrument),
      genres: conn.requester.genres.map((g) => g.genre),
    },
    receiver: {
      id: conn.receiver.id,
      displayName: conn.receiver.displayName,
      city: conn.receiver.city,
      skillLevel: conn.receiver.skillLevel,
      instruments: conn.receiver.instruments.map((i) => i.instrument),
      genres: conn.receiver.genres.map((g) => g.genre),
    },
  }));

  return NextResponse.json({ connections: mapped });
}

/**
 * POST /api/connections
 * Express interest in another musician's profile.
 * Body: { receiverId: string }
 *
 * Rules:
 * - Cannot connect to self
 * - Cannot have existing connection (pending/accepted) between same pair
 * - 24h cooldown on declined connections (R27)
 * - Cannot connect to someone who blocked you
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get requester profile
  const requester = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!requester) {
    return NextResponse.json({ error: "Complete your profile first" }, { status: 403 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = connectionSchema.safeParse(body);
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

  const receiverId = parsed.data.receiverId;

  // Cannot connect to self
  if (receiverId === requester.id) {
    return NextResponse.json(
      { error: "Cannot connect to yourself" },
      { status: 400 },
    );
  }

  // Check receiver exists
  const receiver = await prisma.profile.findUnique({
    where: { id: receiverId },
    select: { id: true, userId: true },
  });

  if (!receiver) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check if blocked (either direction)
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { userId, blockedUserId: receiver.userId },
        { userId: receiver.userId, blockedUserId: userId },
      ],
    },
  });

  if (block) {
    return NextResponse.json(
      { error: "Cannot connect to this user" },
      { status: 403 },
    );
  }

  // Check existing connection
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId: requester.id, receiverId },
        { requesterId: receiverId, receiverId: requester.id },
      ],
    },
  });

  if (existing) {
    // If there's a declined connection within 24h, cooldown applies (R27)
    if (existing.status === "declined") {
      const cooldownEnd = new Date(existing.createdAt.getTime() + 24 * 60 * 60 * 1000);
      const now = new Date();

      if (now < cooldownEnd) {
        return NextResponse.json(
          {
            error: "Already expressed interest",
            code: "COOLDOWN_ACTIVE",
            retryAfter: cooldownEnd.toISOString(),
          },
          { status: 409 },
        );
      }
    } else {
      // Existing pending or accepted connection
      return NextResponse.json(
        {
          error: `Connection already exists (${existing.status})`,
          code: "CONNECTION_EXISTS",
        },
        { status: 409 },
      );
    }
  }

  // Create connection
  const connection = await prisma.connection.create({
    data: {
      requesterId: requester.id,
      receiverId,
      status: "pending",
    },
  });

  return NextResponse.json(
    {
      connection: {
        id: connection.id,
        status: connection.status,
        createdAt: connection.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
