import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, profileCreateSchema } from "@/lib/validations/profile";
import { discoverProfiles } from "@/lib/discovery";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const instrument = url.searchParams.get("instrument") || undefined;
  const genre = url.searchParams.get("genre") || undefined;
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");
  const radiusStr = url.searchParams.get("radius");
  const skillLevel = url.searchParams.get("skill") || undefined;
  const pageStr = url.searchParams.get("page");

  const lat = latStr ? parseFloat(latStr) : undefined;
  const lng = lngStr ? parseFloat(lngStr) : undefined;
  const radius = radiusStr ? parseInt(radiusStr, 10) : undefined;
  const page = pageStr ? parseInt(pageStr, 10) : undefined;

  // Validate numeric params
  if (latStr && isNaN(lat as number)) {
    return NextResponse.json({ error: "Invalid lat parameter" }, { status: 400 });
  }
  if (lngStr && isNaN(lng as number)) {
    return NextResponse.json({ error: "Invalid lng parameter" }, { status: 400 });
  }
  if (radiusStr && (isNaN(radius as number) || (radius as number) < 1)) {
    return NextResponse.json({ error: "Invalid radius parameter" }, { status: 400 });
  }
  if (pageStr && (isNaN(page as number) || (page as number) < 1)) {
    return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
  }

  // Validate skill level
  if (
    skillLevel &&
    !["beginner", "intermediate", "advanced", "pro"].includes(skillLevel)
  ) {
    return NextResponse.json(
      { error: "Invalid skill parameter" },
      { status: 400 },
    );
  }

  try {
    const result = await discoverProfiles({
      instrument,
      genre,
      lat,
      lng,
      radiusKm: radius,
      skillLevel,
      page,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discovery error:", error);
    return NextResponse.json(
      { error: "Discovery search failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileCreateSchema.safeParse(body);
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

  const { instruments, genres, visibility, ...profileData } = parsed.data;
  const userId = session.user.id;

  // Check if user already has a profile
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json(
      { error: "Profile already exists. Use PATCH to update." },
      { status: 409 },
    );
  }

  const profile = await prisma.profile.create({
    data: {
      ...profileData,
      visibility,
      publishedAt: new Date(),
      userId,
      instruments: {
        create: instruments.map((instrument) => ({ instrument })),
      },
      genres: {
        create: genres.map((genre) => ({ genre })),
      },
    },
    include: {
      instruments: { select: { instrument: true } },
      genres: { select: { genre: true } },
    },
  });

  // Mark onboarding as completed
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });

  return NextResponse.json(
    {
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        skillLevel: profile.skillLevel,
        city: profile.city,
        instruments: profile.instruments.map((i) => i.instrument),
        genres: profile.genres.map((g) => g.genre),
        visibility: profile.visibility,
        publishedAt: profile.publishedAt,
      },
    },
    { status: 201 },
  );
}
