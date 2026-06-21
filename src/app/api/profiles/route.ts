import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema, profileCreateSchema } from "@/lib/validations/profile";

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
