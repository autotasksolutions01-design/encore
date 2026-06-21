import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { PublicProfileView } from "./public-profile-view";

export const revalidate = 60;

type Params = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: { displayName: true },
  });

  if (!profile) return { title: "Perfil no encontrado — Encore" };
  return { title: `${profile.displayName} — Encore` };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
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
    notFound();
  }

  const isOwner = session?.user?.id === profile.userId;
  const isPublic = profile.visibility === "public";

  // Check if connected
  let isConnected = false;
  if (!isOwner && !isPublic && session?.user?.id) {
    const connection = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: session.user.id, receiverId: profile.id, status: "accepted" },
          { requesterId: profile.id, receiverId: session.user.id, status: "accepted" },
        ],
      },
    });
    isConnected = connection !== null;
  }

  const canView = isOwner || isPublic || isConnected;

  const profileData = {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    skillLevel: profile.skillLevel,
    city: profile.city,
    avatarUrl: profile.user.avatarUrl,
    name: profile.user.name,
    visibility: profile.visibility,
    instruments: profile.instruments.map((i) => i.instrument),
    genres: profile.genres.map((g) => g.genre),
    lookingFor: profile.lookingFor.map((lf) => ({
      instrument: lf.instrument,
      genre: lf.genre,
      role: lf.role,
    })),
    audioClips: profile.audioClips.map((clip) => ({
      id: clip.id,
      title: clip.title,
      duration: clip.duration,
      uploadedAt: clip.uploadedAt.toISOString(),
    })),
    publishedAt: profile.publishedAt?.toISOString() ?? null,
  };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <p className="text-slate-400">Cargando...</p>
        </div>
      }
    >
      <PublicProfileView
        profile={profileData}
        isOwner={isOwner}
        canView={canView}
        sessionUserId={session?.user?.id ?? null}
      />
    </Suspense>
  );
}
