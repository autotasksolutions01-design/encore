"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { profileUpdateSchema } from "@/lib/validations/profile";
import type { ProfileUpdateInput } from "@/lib/validations/profile";
import { useProfileDraftStore } from "@/lib/stores/profile-draft";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "pro"] as const;
const VISIBILITY_OPTIONS = ["public", "connections"] as const;

const INSTRUMENT_OPTIONS = [
  "guitar", "bass", "drums", "piano", "keys",
  "saxophone", "trumpet", "trombone", "flute", "clarinet",
  "violin", "cello", "voice", "percussion", "synth",
  "charango", "bandoneon", "cajon",
];

const GENRE_OPTIONS = [
  "rock", "indie", "pop", "electronic",
  "jazz", "blues", "funk", "soul",
  "metal", "punk", "hardcore",
  "folk", "cumbia", "tango", "salsa",
  "reggae", "hiphop", "r&b", "classical",
];

export default function ProfileEditPage() {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const router = useRouter();
  const { data: session } = useSession();
  const { draft, setDraft, clearDraft, lastSaved } = useProfileDraftStore();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    skillLevel: "" as string,
    city: "",
    instruments: [] as string[],
    genres: [] as string[],
    visibility: "public" as string,
  });

  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Fetch current user's profile via the session user ID
        const res = await fetch(`/api/profiles/by-user`);
        if (res.status === 404) {
          // Profile doesn't exist yet — show form empty
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        const p = data.profile;

        setProfileId(p.id);
        setForm({
          displayName: p.displayName || "",
          bio: p.bio || "",
          skillLevel: p.skillLevel || "",
          city: p.city || "",
          instruments: p.instruments || [],
          genres: p.genres || [],
          visibility: p.visibility || "public",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Restore draft if exiting mid-edit
  useEffect(() => {
    if (draft && !loading && !profileId) {
      setForm((prev) => ({
        displayName: (draft.displayName as string) || prev.displayName,
        bio: (draft.bio as string) || prev.bio,
        skillLevel: (draft.skillLevel as string) || prev.skillLevel,
        city: (draft.city as string) || prev.city,
        instruments: (draft.instruments as string[]) || prev.instruments,
        genres: (draft.genres as string[]) || prev.genres,
        visibility: (draft.visibility as string) || prev.visibility,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Auto-save every 30s
  useEffect(() => {
    if (!profileId) return;

    autoSaveTimer.current = setInterval(() => {
      const partial: Partial<ProfileUpdateInput> = {
        displayName: form.displayName,
        bio: form.bio || undefined,
        skillLevel: form.skillLevel as ProfileUpdateInput["skillLevel"],
        city: form.city,
        instruments: form.instruments,
        genres: form.genres,
        visibility: form.visibility as ProfileUpdateInput["visibility"],
      };

      // Save to Zustand
      setDraft(partial);

      // Save to API
      fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      }).then((res) => {
        if (res.ok) {
          setSavedAt(new Date().toLocaleTimeString());
        }
      }).catch(() => {
        // Silently fail — draft is in local storage
      });
    }, 30000);

    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [profileId, form, setDraft]);

  const handlePublish = async () => {
    if (!profileId) return;
    setSaving(true);
    setError(null);

    try {
      const partial: Partial<ProfileUpdateInput> = {
        displayName: form.displayName,
        bio: form.bio || undefined,
        skillLevel: form.skillLevel as ProfileUpdateInput["skillLevel"],
        city: form.city,
        instruments: form.instruments,
        genres: form.genres,
        visibility: form.visibility as ProfileUpdateInput["visibility"],
      };

      const parsed = profileUpdateSchema.safeParse(partial);
      if (!parsed.success) {
        setError("Some fields are invalid. Check your inputs.");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, publish: true }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to publish");
      }

      clearDraft();
      setSavedAt(new Date().toLocaleTimeString());
      router.push(`/es/profile/${profileId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error publishing");
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (field: "instruments" | "genres", item: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter((i) => i !== item)
        : [...prev[field], item],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">{tc("app.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{t("editTitle")}</h1>
        {savedAt && (
          <span className="text-xs text-slate-500">
            {t("lastSaved")}: {savedAt}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t("displayName")}
          </label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, displayName: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t("bio")}
          </label>
          <textarea
            value={form.bio}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, bio: e.target.value }))
            }
            rows={4}
            maxLength={500}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
          />
          <p className="text-xs text-slate-500 text-right mt-1">
            {form.bio.length}/500
          </p>
        </div>

        {/* Skill Level */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("skillLevel")}
          </label>
          <div className="flex flex-wrap gap-2">
            {SKILL_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, skillLevel: level }))
                }
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  form.skillLevel === level
                    ? "border-brand-500 bg-brand-600/20 text-brand-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                )}
              >
                {t(`skill.${level}`)}
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            {t("city")}
          </label>
          <input
            type="text"
            value={form.city}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, city: e.target.value }))
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Instruments */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("instruments")}
          </label>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENT_OPTIONS.map((inst) => (
              <button
                key={inst}
                type="button"
                onClick={() => toggleItem("instruments", inst)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                  form.instruments.includes(inst)
                    ? "border-brand-500 bg-brand-600/20 text-brand-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                )}
              >
                {inst}
              </button>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("genres")}
          </label>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => toggleItem("genres", genre)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                  form.genres.includes(genre)
                    ? "border-brand-500 bg-brand-600/20 text-brand-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {t("visibility")}
          </label>
          <div className="flex gap-3">
            {VISIBILITY_OPTIONS.map((vis) => (
              <button
                key={vis}
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, visibility: vis }))
                }
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  form.visibility === vis
                    ? "border-brand-500 bg-brand-600/20 text-brand-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                )}
              >
                {vis === "public" ? t("visibilityPublic") : t("visibilityConnections")}
              </button>
            ))}
          </div>
        </div>

        {/* Publish */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500">{t("autoSave")}</p>
          <button
            type="button"
            onClick={handlePublish}
            disabled={saving || !profileId}
            className={cn(
              "rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed",
              saving && "opacity-60 cursor-wait",
            )}
          >
            {saving ? tc("app.loading") : tc("actions.publish")}
          </button>
        </div>
      </div>
    </div>
  );
}
