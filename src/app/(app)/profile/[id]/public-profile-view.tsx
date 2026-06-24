"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

interface ProfileData {
  id: string;
  displayName: string;
  bio: string | null;
  skillLevel: string;
  city: string;
  avatarUrl: string | null;
  name: string | null;
  visibility: string;
  instruments: string[];
  genres: string[];
  lookingFor: { instrument: string | null; genre: string | null; role: string }[];
  audioClips: { id: string; title: string; duration: number | null; uploadedAt: string }[];
  publishedAt: string | null;
}

export function PublicProfileView({
  profile,
  isOwner,
  canView,
  sessionUserId,
}: {
  profile: ProfileData;
  isOwner: boolean;
  canView: boolean;
  sessionUserId: string | null;
}) {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const router = useRouter();
  const [interestLoading, setInterestLoading] = useState(false);
  const [interestSent, setInterestSent] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);

  const handleExpressInterest = async () => {
    if (!sessionUserId) {
      router.push("/es/login");
      return;
    }
    setInterestLoading(true);
    setInterestError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: profile.id }),
      });
      if (res.status === 409) {
        setInterestError("Already sent. Wait before retrying.");
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to express interest");
      } else {
        setInterestSent(true);
      }
    } catch (err) {
      setInterestError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setInterestLoading(false);
    }
  };

  // Format skill level
  const skillLabel = t(`skill.${profile.skillLevel}`, { defaultValue: profile.skillLevel });

  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-white mb-2">
          {profile.displayName}
        </h1>
        <p className="text-slate-400">{t("connectionsOnly")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-24 w-24 rounded-full border-2 border-slate-700 object-cover"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
              <span className="text-3xl text-slate-500 font-bold">
                {profile.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profile.displayName}
              </h1>
              <p className="text-sm text-slate-400">{profile.city}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isOwner ? (
                <Link
                  href="/es/profile/edit"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  {tc("actions.edit")}
                </Link>
              ) : sessionUserId && !interestSent ? (
                <button
                  onClick={handleExpressInterest}
                  disabled={interestLoading}
                  className={cn(
                    "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors",
                    interestLoading && "opacity-60 cursor-wait",
                  )}
                >
                  {interestLoading
                    ? tc("app.loading")
                    : t("expressInterest")}
                </button>
              ) : interestSent ? (
                <span className="rounded-lg bg-green-900/40 border border-green-800 px-4 py-2 text-sm font-medium text-green-300">
                  ✓ Sent
                </span>
              ) : null}
            </div>
          </div>

          {/* Skill badge */}
          <span className="inline-block rounded-full bg-brand-600/20 border border-brand-600/40 px-3 py-1 text-xs font-medium text-brand-300">
            {skillLabel}
          </span>

          {/* Visibility badge */}
          {profile.visibility === "connections" && (
            <span className="ml-2 inline-block rounded-full bg-yellow-900/20 border border-yellow-700/40 px-3 py-1 text-xs font-medium text-yellow-400">
              {t("visibilityConnections")}
            </span>
          )}

          {interestError && (
            <p className="text-sm text-red-400 mt-1">{interestError}</p>
          )}
        </div>
      </div>

      {/* Audio Clips — demos first */}
      {profile.audioClips.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
            {t("audioClips")}
          </h2>
          <div className="space-y-2">
            {profile.audioClips.map((clip) => (
              <div
                key={clip.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3"
              >
                <span className="text-sm font-medium text-white">
                  {clip.title}
                </span>
                {clip.duration != null && (
                  <span className="text-xs text-slate-500">
                    {Math.round(clip.duration)}s
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Looking For — intent chips */}
      {profile.lookingFor.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
            {t("lookingFor")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.lookingFor.map((lf, i) => (
              <span
                key={i}
                className="rounded-full border border-brand-600/40 bg-brand-600/10 px-3 py-1 text-sm font-medium text-brand-300"
              >
                {t(`role.${lf.role}`, { defaultValue: lf.role })}
                {lf.instrument ? ` · ${lf.instrument}` : ""}
                {lf.genre ? ` · ${lf.genre}` : ""}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Instruments */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          {t("instruments")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.instruments.map((inst) => (
            <span
              key={inst}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300"
            >
              {inst}
            </span>
          ))}
        </div>
      </section>

      {/* Genres */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
          {t("genres")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {profile.genres.map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-medium text-slate-300"
            >
              {genre}
            </span>
          ))}
        </div>
      </section>

      {/* Bio */}
      {profile.bio && (
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">
            {t("bio")}
          </h2>
          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {profile.bio}
          </p>
        </section>
      )}
    </div>
  );
}
