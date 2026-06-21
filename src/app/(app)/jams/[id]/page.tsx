import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { JamRespondButton } from "@/app/_components/JamRespondButton";
import Link from "next/link";
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

  // Determine if current user is the creator, and their existing response
  let isCreator = false;
  let userResponse: JamResponseType | null = null;

  if (isAuthenticated && userId) {
    // Get profile to compare with creator
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    isCreator = profile?.id === jam.creator.id;

    // Check existing response
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

  return (
    <div className="max-w-3xl space-y-8">
      {/* Back link */}
      <Link
        href="/es/jams"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
      >
        ← Volver a jams
      </Link>

      {/* Jam header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-600/20 text-brand-400">
                {jam.genre}
              </span>
              <StatusBadge status={jam.status} />
            </div>
            <h1 className="text-2xl font-bold text-white mt-2">{jam.title}</h1>
          </div>

          {/* Creator actions */}
          {isCreator && jam.status === "active" && (
            <CancelJamButton jamId={jam.id} />
          )}
        </div>

        {jam.description && (
          <p className="text-slate-300 leading-relaxed">{jam.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Fecha y hora
            </p>
            <p className="text-sm text-slate-200">
              {formattedDate} — {formattedTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Lugar
            </p>
            <p className="text-sm text-slate-200">{jam.locationName}</p>
          </div>
        </div>
      </div>

      {/* Creator profile */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Organizado por
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-lg font-bold">
            {jam.creator.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <Link
              href={`/es/profile/${jam.creator.id}`}
              className="text-white font-medium hover:text-brand-400 transition-colors"
            >
              {jam.creator.displayName}
            </Link>
            <p className="text-sm text-slate-400">
              {jam.creator.instruments.map((i) => i.instrument).join(", ")} ·{" "}
              {jam.creator.city}
            </p>
          </div>
        </div>
      </div>

      {/* Responses section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Respuestas ({jam.responses.length})
          </h2>
          {canRespond && (
            <JamRespondButton
              jamId={jam.id}
              currentResponse={userResponse}
            />
          )}
        </div>

        {!isAuthenticated && (
          <p className="text-sm text-slate-500 py-4">
            Iniciá sesión para responder a esta jam.
          </p>
        )}

        {isExpired && jam.status !== "active" && (
          <p className="text-sm text-slate-500 py-4">
            Esta jam ya no acepta respuestas.
          </p>
        )}

        {jam.responses.length === 0 && isAuthenticated && !isExpired && (
          <p className="text-sm text-slate-500 py-4">
            Sé el primero en responder.
          </p>
        )}

        {jam.responses.length > 0 && (
          <div className="space-y-3">
            {jam.responses.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50"
              >
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-bold shrink-0">
                  {(r.responder.name ?? "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {r.responder.profile ? (
                      <Link
                        href={`/es/profile/${r.responder.profile.id}`}
                        className="text-sm font-medium text-white hover:text-brand-400 truncate transition-colors"
                      >
                        {r.responder.profile.displayName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-slate-300 truncate">
                        {r.responder.name ?? "Músico"}
                      </span>
                    )}
                    <ResponseTypeBadge type={r.response} />
                  </div>
                  {r.responder.profile && (
                    <p className="text-xs text-slate-500 truncate">
                      {r.responder.profile.instruments
                        .map((i) => i.instrument)
                        .join(", ")}{" "}
                      · {r.responder.profile.skillLevel}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400",
    expired: "bg-slate-500/20 text-slate-400",
  };

  const labels: Record<string, string> = {
    active: "Activa",
    cancelled: "Cancelada",
    expired: "Expirada",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-slate-500/20 text-slate-400"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ResponseTypeBadge({ type }: { type: string }) {
  const isGoing = type === "going";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        isGoing
          ? "bg-brand-600/20 text-brand-400"
          : "bg-slate-600/20 text-slate-400"
      }`}
    >
      {isGoing ? "Voy" : "Me interesa"}
    </span>
  );
}

function CancelJamButton({ jamId }: { jamId: string }) {
  // Server action for cancelling a jam
  async function cancelJam() {
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

  return (
    <form action={cancelJam}>
      <button
        type="submit"
        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
      >
        Cancelar jam
      </button>
    </form>
  );
}
