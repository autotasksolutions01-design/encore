import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/jams/[id]
 * Returns a single jam session with all responses, including
 * responder profiles with instruments and display names (R37).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const jam = await prisma.jamSession.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          skillLevel: true,
          city: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
          user: { select: { avatarUrl: true } },
        },
      },
      responses: {
        include: {
          responder: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              profile: {
                select: {
                  id: true,
                  displayName: true,
                  instruments: { select: { instrument: true } },
                  skillLevel: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  const mapped = {
    id: jam.id,
    title: jam.title,
    genre: jam.genre,
    dateTime: jam.dateTime.toISOString(),
    lat: jam.lat,
    lng: jam.lng,
    locationName: jam.locationName,
    description: jam.description,
    status: jam.status,
    createdAt: jam.createdAt.toISOString(),
    creator: {
      id: jam.creator.id,
      displayName: jam.creator.displayName,
      skillLevel: jam.creator.skillLevel,
      city: jam.creator.city,
      avatarUrl: jam.creator.user.avatarUrl,
      instruments: jam.creator.instruments.map((i) => i.instrument),
      genres: jam.creator.genres.map((g) => g.genre),
    },
    responses: jam.responses.map((r) => ({
      id: r.id,
      response: r.response,
      createdAt: r.createdAt.toISOString(),
      responder: {
        id: r.responder.id,
        name: r.responder.name,
        avatarUrl: r.responder.avatarUrl,
        profile: r.responder.profile
          ? {
              id: r.responder.profile.id,
              displayName: r.responder.profile.displayName,
              instruments: r.responder.profile.instruments.map(
                (i) => i.instrument,
              ),
              skillLevel: r.responder.profile.skillLevel,
            }
          : null,
      },
    })),
  };

  return NextResponse.json({ jam: mapped });
}

/**
 * PATCH /api/jams/[id]
 * Cancels a jam session. Only the creator can cancel.
 * Body: { status: "cancelled" }
 *
 * R39: Jam creator MAY cancel session; respondents notified.
 * (Notification delivery is deferred to a future notification system.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  // Find jam and verify ownership
  const jam = await prisma.jamSession.findUnique({
    where: { id },
    include: {
      creator: { select: { userId: true } },
    },
  });

  if (!jam) {
    return NextResponse.json({ error: "Jam not found" }, { status: 404 });
  }

  if (jam.creator.userId !== userId) {
    return NextResponse.json(
      { error: "Only the creator can modify this jam" },
      { status: 403 },
    );
  }

  if (jam.status !== "active") {
    return NextResponse.json(
      { error: `Cannot cancel a jam that is already ${jam.status}` },
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

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>).status !== "cancelled"
  ) {
    return NextResponse.json(
      {
        error: "Invalid status",
        message: "Only 'cancelled' status is accepted via PATCH",
      },
      { status: 422 },
    );
  }

  const updated = await prisma.jamSession.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({
    jam: {
      id: updated.id,
      status: updated.status,
      title: updated.title,
    },
  });
}
