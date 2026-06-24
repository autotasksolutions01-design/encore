import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JamDetailClient } from "@/app/_components/JamDetailClient";
import { getR2PublicUrl } from "@/lib/r2-url";
import { notFound } from "next/navigation";
import type { JamResponseType } from "@prisma/client";

interface JamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JamDetailPage({ params }: JamDetailPageProps) {
  const { id } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  const isAuthenticated = !!userId;

  const jam = await prisma.jamSession.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          skillLevel: true,
          city: true,
          bio: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
          user: { select: { avatarUrl: true, name: true } },
          audioClips: {
            select: {
              id: true,
              title: true,
              transcodedKey: true,
              waveformJson: true,
              duration: true,
            },
            orderBy: { uploadedAt: "desc" },
            take: 1,
          },
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
    notFound();
  }

  let isCreator = false;
  let userResponse: JamResponseType | null = null;

  if (isAuthenticated && userId) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    isCreator = profile?.id === jam.creator.id;

    const existingResponse = await prisma.jamResponse.findUnique({
      where: {
        jamId_userId: { jamId: id, userId },
      },
    });
    userResponse = existingResponse?.response ?? null;
  }

  const formattedDate = new Date(jam.dateTime).toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = new Date(jam.dateTime).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isExpired = jam.status !== "active" || new Date(jam.dateTime) <= new Date();
  const canRespond = isAuthenticated && !isCreator && !isExpired;

  const organizerClips = jam.creator.audioClips.map((clip) => ({
    id: clip.id,
    title: clip.title,
    audioUrl: getR2PublicUrl(clip.transcodedKey),
    waveformData: Array.isArray(clip.waveformJson)
      ? (clip.waveformJson as number[])
      : [],
    duration: clip.duration as number | null,
  }));

  const organizer = {
    id: jam.creator.id,
    displayName: jam.creator.displayName,
    instruments: jam.creator.instruments.map((i) => i.instrument),
    skillLevel: jam.creator.skillLevel,
    city: jam.creator.city,
    audioClips: organizerClips,
  };

  const lineup = jam.responses.map((r) => ({
    id: r.id,
    profileId: r.responder.profile?.id ?? null,
    name: r.responder.name ?? "Músico",
    displayName: r.responder.profile?.displayName ?? r.responder.name ?? "Músico",
    instruments:
      r.responder.profile?.instruments.map((i) => i.instrument) ?? [],
    skillLevel: r.responder.profile?.skillLevel ?? "",
    response: r.response as "interested" | "going",
  }));

  return (
    <JamDetailClient
      id={jam.id}
      title={jam.title}
      genre={jam.genre}
      description={jam.description}
      formattedDate={formattedDate}
      formattedTime={formattedTime}
      locationName={jam.locationName}
      status={jam.status}
      isCreator={isCreator}
      isAuthenticated={isAuthenticated}
      canRespond={canRespond}
      isExpired={isExpired}
      userResponse={userResponse}
      organizer={organizer}
      lineup={lineup}
      responseCount={jam.responses.length}
      cancelAction={cancelJam.bind(null, jam.id)}
    />
  );
}

async function cancelJam(jamId: string) {
  "use server";
  const { auth } = await import("@/lib/auth");
  const { prisma } = await import("@/lib/prisma");
  const { revalidatePath } = await import("next/cache");
  const { redirect } = await import("next/navigation");

  const session = await auth();
  if (!session?.user?.id) return;

  const jam = await prisma.jamSession.findUnique({
    where: { id: jamId },
    include: { creator: { select: { userId: true } } },
  });

  if (!jam || jam.creator.userId !== session.user.id) return;

  await prisma.jamSession.update({
    where: { id: jamId },
    data: { status: "cancelled" },
  });

  revalidatePath(`/es/jams/${jamId}`);
  redirect(`/es/jams/${jamId}`);
}
