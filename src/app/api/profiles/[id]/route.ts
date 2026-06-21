import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validations/profile";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      instruments: { select: { instrument: true } },
      genres: { select: { genre: true } },
      lookingFor: {
        select: {
          instrument: true,
          genre: true,
          role: true,
        },
      },
      audioClips: {
        select: {
          id: true,
          title: true,
          transcodedKey: true,
          waveformJson: true,
          duration: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
      user: {
        select: {
          avatarUrl: true,
          name: true,
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Visibility guard
  const isOwner = session?.user?.id === profile.userId;
  const isPublic = profile.visibility === "public";

  // Look up the current user's Profile to get the Profile CUID for Connection queries.
  // session.user.id is the User model ID, but Connection.requesterId/receiverId
  // reference Profile.id — they are different records.
  let isConnected = false;
  if (!isOwner && !isPublic && session?.user?.id) {
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (currentProfile) {
      const connection = await prisma.connection.findFirst({
        where: {
          OR: [
            { requesterId: currentProfile.id, receiverId: profile.id, status: "accepted" },
            { requesterId: profile.id, receiverId: currentProfile.id, status: "accepted" },
          ],
        },
      });
      isConnected = !!connection;
    }
  }

  if (!isOwner && !isPublic && !isConnected) {
    // For connections-only profiles, return limited data
    return NextResponse.json({
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        visibility: profile.visibility,
        connectionsOnly: true,
      },
    });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      userId: isOwner ? profile.userId : undefined,
      displayName: profile.displayName,
      bio: profile.bio,
      skillLevel: profile.skillLevel,
      city: profile.city,
      lat: profile.lat,
      lng: profile.lng,
      avatarKey: profile.avatarKey,
      avatarUrl: profile.user.avatarUrl,
      name: profile.user.name,
      visibility: profile.visibility,
      publishedAt: profile.publishedAt,
      instruments: profile.instruments.map((i) => i.instrument),
      genres: profile.genres.map((g) => g.genre),
      lookingFor: profile.lookingFor.map((lf) => ({
        instrument: lf.instrument,
        genre: lf.genre,
        role: lf.role,
      })),
      audioClips: profile.audioClips,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileUpdateSchema.safeParse(body);
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

  const updateData = parsed.data;

  // Separate scalar fields from relation fields
  const {
    instruments,
    genres,
    visibility,
    ...scalarFields
  } = updateData;

  // Update scalar fields
  const updatePayload: Record<string, unknown> = { ...scalarFields };
  if (visibility !== undefined) {
    updatePayload.visibility = visibility;
  }

  // If publish flag is set, set publishedAt
  if (body && typeof body === "object" && "publish" in body && (body as Record<string, unknown>).publish === true) {
    updatePayload.publishedAt = new Date();
  }

  // Update in transaction
  const updated = await prisma.$transaction(async (tx) => {
    // Update profile record
    const prof = await tx.profile.update({
      where: { id },
      data: updatePayload,
    });

    // Recreate instruments if provided
    if (instruments !== undefined) {
      await tx.profileInstrument.deleteMany({ where: { profileId: id } });
      if (instruments.length > 0) {
        await tx.profileInstrument.createMany({
          data: instruments.map((inst) => ({ profileId: id, instrument: inst })),
        });
      }
    }

    // Recreate genres if provided
    if (genres !== undefined) {
      await tx.profileGenre.deleteMany({ where: { profileId: id } });
      if (genres.length > 0) {
        await tx.profileGenre.createMany({
          data: genres.map((genre) => ({ profileId: id, genre })),
        });
      }
    }

    return prof;
  });

  // Fetch full profile with relations
  const fullProfile = await prisma.profile.findUnique({
    where: { id: updated.id },
    include: {
      instruments: { select: { instrument: true } },
      genres: { select: { genre: true } },
      lookingFor: {
        select: {
          instrument: true,
          genre: true,
          role: true,
        },
      },
      audioClips: {
        select: {
          id: true,
          title: true,
          transcodedKey: true,
          waveformJson: true,
          duration: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  return NextResponse.json({
    profile: {
      id: fullProfile!.id,
      displayName: fullProfile!.displayName,
      bio: fullProfile!.bio,
      skillLevel: fullProfile!.skillLevel,
      city: fullProfile!.city,
      lat: fullProfile!.lat,
      lng: fullProfile!.lng,
      avatarKey: fullProfile!.avatarKey,
      visibility: fullProfile!.visibility,
      publishedAt: fullProfile!.publishedAt,
      instruments: fullProfile!.instruments.map((i) => i.instrument),
      genres: fullProfile!.genres.map((g) => g.genre),
      lookingFor: fullProfile!.lookingFor.map((lf) => ({
        instrument: lf.instrument,
        genre: lf.genre,
        role: lf.role,
      })),
      audioClips: fullProfile!.audioClips,
    },
  });
}
