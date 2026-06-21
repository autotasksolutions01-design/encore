import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
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
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      skillLevel: profile.skillLevel,
      city: profile.city,
      lat: profile.lat,
      lng: profile.lng,
      avatarKey: profile.avatarKey,
      visibility: profile.visibility,
      publishedAt: profile.publishedAt,
      instruments: profile.instruments.map((i) => i.instrument),
      genres: profile.genres.map((g) => g.genre),
      lookingFor: profile.lookingFor.map((lf) => ({
        instrument: lf.instrument,
        genre: lf.genre,
        role: lf.role,
      })),
    },
  });
}
