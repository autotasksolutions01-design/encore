"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { onboardingSchema } from "@/lib/validations/auth";
import type { OnboardingInput } from "@/lib/validations/auth";
import { useAuthStore } from "@/lib/stores/auth";
import { useProfileDraftStore } from "@/lib/stores/profile-draft";

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "pro"] as const;

const COLLAB_ROLES = [
  { value: "jam", icon: "🎸" },
  { value: "band", icon: "👥" },
  { value: "session", icon: "🎙️" },
  { value: "collab", icon: "🤝" },
] as const;

// Common instruments for LATAM musicians
const INSTRUMENT_OPTIONS = [
  "guitar", "bass", "drums", "piano", "keys",
  "saxophone", "trumpet", "trombone", "flute", "clarinet",
  "violin", "cello", "voice", "percussion", "synth",
  "charango", "bandoneon", "cajon",
];

// Common genres
const GENRE_OPTIONS = [
  "rock", "indie", "pop", "electronic",
  "jazz", "blues", "funk", "soul",
  "metal", "punk", "hardcore",
  "folk", "cumbia", "tango", "salsa",
  "reggae", "hiphop", "r&b", "classical",
];

type StepData = {
  displayName: string;
  instruments: string[];
  genres: string[];
  skillLevel: (typeof SKILL_LEVELS)[number] | "";
  city: string;
  bio: string;
  lookingFor: { instrument: string; genre: string; role: string }[];
};

const STEP_FIELDS: (keyof StepData)[] = [
  "displayName",
  "instruments",
  "genres",
  "skillLevel",
  "city",
  "bio",
  "lookingFor",
];

const STEPS = STEP_FIELDS.length;

export function OnboardingWizard({ userId }: { userId: string }) {
  const { t } = useTranslation("auth");
  const { t: tp } = useTranslation("profile");
  const router = useRouter();
  const { update } = useSession();
  const { setOnboardingCompleted } = useAuthStore();
  const { draft, setDraft, clearDraft } = useProfileDraftStore();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<StepData>({
    displayName: "",
    instruments: [],
    genres: [],
    skillLevel: "",
    city: "",
    bio: "",
    lookingFor: [],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Restore draft from Zustand
  useEffect(() => {
    if (draft && !data.displayName) {
      const restored = {
        displayName: draft.displayName || "",
        instruments: draft.instruments || [],
        genres: draft.genres || [],
        skillLevel: draft.skillLevel || "",
        city: draft.city || "",
        bio: draft.bio || "",
        lookingFor: draft.lookingFor || [],
      };
      setData(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to Zustand
  useEffect(() => {
    if (data.displayName || data.instruments.length > 0) {
      setDraft(data);
    }
  }, [data, setDraft]);

  const updateField = <K extends keyof StepData>(
    field: K,
    value: StepData[K],
  ) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleArrayItem = (field: "instruments" | "genres", item: string) => {
    setData((prev) => {
      const current = prev[field];
      const next = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [field]: next };
    });
  };

  const addLookingFor = () => {
    setData((prev) => ({
      ...prev,
      lookingFor: [...prev.lookingFor, { instrument: "", genre: "", role: "" }],
    }));
  };

  const removeLookingFor = (index: number) => {
    setData((prev) => ({
      ...prev,
      lookingFor: prev.lookingFor.filter((_, i) => i !== index),
    }));
  };

  const updateLookingFor = (
    index: number,
    field: "instrument" | "genre" | "role",
    value: string,
  ) => {
    setData((prev) => {
      const next = prev.lookingFor.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      );
      return { ...prev, lookingFor: next };
    });
  };

  const validateStep = (stepIndex: number): boolean => {
    const field = STEP_FIELDS[stepIndex];
    const newErrors: Record<string, string> = {};

    switch (field) {
      case "displayName":
        if (!data.displayName.trim()) {
          newErrors.displayName = "Required";
        }
        break;
      case "instruments":
        if (data.instruments.length === 0) {
          newErrors.instruments = "At least one instrument is required";
        }
        break;
      case "genres":
        if (data.genres.length === 0) {
          newErrors.genres = "At least one genre is required";
        }
        break;
      case "skillLevel":
        if (!data.skillLevel) {
          newErrors.skillLevel = "Skill level is required";
        }
        break;
      case "city":
        if (!data.city.trim()) {
          newErrors.city = "City is required";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, STEPS - 1));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    if (!validateStep(step)) return;
    setSaving(true);

    try {
      // Validate full onboarding data
      const payload: OnboardingInput = {
        displayName: data.displayName,
        instruments: data.instruments,
        genres: data.genres,
        skillLevel: data.skillLevel as OnboardingInput["skillLevel"],
        city: data.city,
        bio: data.bio || undefined,
        lookingFor:
          data.lookingFor.length > 0
            ? data.lookingFor
                .filter((lf) => lf.role)
                .map((lf) => ({
                  instrument: lf.instrument || undefined,
                  genre: lf.genre || undefined,
                  role: lf.role as OnboardingInput["lookingFor"] extends Array<infer T> ? T extends { role: infer R } ? R : never : never,
                }))
            : undefined,
      };

      const parsed = onboardingSchema.safeParse(payload);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        setSaving(false);
        return;
      }

      // Create profile via API
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create profile");
      }

      // Mark onboarding completed
      setOnboardingCompleted();
      await update(); // Refresh session
      clearDraft();

      setSuccess(true);
      setTimeout(() => {
        router.push("/es/discover");
        router.refresh();
      }, 1500);
    } catch (err) {
      setErrors({
        submit:
          err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStepLabel = () => {
    const field = STEP_FIELDS[step];
    switch (field) {
      case "displayName":
        return t("onboarding.displayName");
      case "instruments":
        return t("onboarding.instruments");
      case "genres":
        return t("onboarding.genres");
      case "skillLevel":
        return t("onboarding.skillLevel");
      case "city":
        return t("onboarding.city");
      case "bio":
        return t("onboarding.bio");
      case "lookingFor":
        return t("onboarding.lookingFor");
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold text-white">
          {t("onboarding.success")}
        </h2>
        <p className="text-sm text-slate-400">{t("app.loading", { ns: "common" })}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">
            {t("onboarding.step", { current: step + 1, total: STEPS })}
          </span>
          <span className="text-brand-400 font-medium">{getStepLabel()}</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-800">
          <div
            className="h-1 rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Submit error */}
      {errors.submit && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 p-3">
          <p className="text-sm text-red-300">{errors.submit}</p>
        </div>
      )}

      {/* Step content */}
      <div className="min-h-[200px]">
        {/* Step 0: Display Name */}
        {step === 0 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.displayName")}
            </label>
            <input
              type="text"
              value={data.displayName}
              onChange={(e) => updateField("displayName", e.target.value)}
              placeholder="Tu nombre artístico"
              autoFocus
              className={cn(
                "w-full rounded-lg border bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-1",
                errors.displayName
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-700 focus:border-brand-500 focus:ring-brand-500",
              )}
            />
            {errors.displayName && (
              <p className="text-sm text-red-400">{errors.displayName}</p>
            )}
          </div>
        )}

        {/* Step 1: Instruments (multi-select) */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.instruments")}
            </label>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENT_OPTIONS.map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => toggleArrayItem("instruments", inst)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                    data.instruments.includes(inst)
                      ? "border-brand-500 bg-brand-600/20 text-brand-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                  )}
                >
                  {inst}
                </button>
              ))}
            </div>
            {errors.instruments && (
              <p className="text-sm text-red-400">{errors.instruments}</p>
            )}
            {data.instruments.length > 0 && (
              <p className="text-xs text-slate-500">
                {data.instruments.length} seleccionados
              </p>
            )}
          </div>
        )}

        {/* Step 2: Genres (multi-select) */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.genres")}
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleArrayItem("genres", genre)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
                    data.genres.includes(genre)
                      ? "border-brand-500 bg-brand-600/20 text-brand-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                  )}
                >
                  {genre}
                </button>
              ))}
            </div>
            {errors.genres && (
              <p className="text-sm text-red-400">{errors.genres}</p>
            )}
            {data.genres.length > 0 && (
              <p className="text-xs text-slate-500">
                {data.genres.length} seleccionados
              </p>
            )}
          </div>
        )}

        {/* Step 3: Skill Level */}
        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.skillLevel")}
            </label>
            <div className="grid gap-2">
              {SKILL_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => updateField("skillLevel", level)}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                    data.skillLevel === level
                      ? "border-brand-500 bg-brand-600/20 text-brand-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
                  )}
                >
                  {tp(`skill.${level}`)}
                </button>
              ))}
            </div>
            {errors.skillLevel && (
              <p className="text-sm text-red-400">{errors.skillLevel}</p>
            )}
          </div>
        )}

        {/* Step 4: City */}
        {step === 4 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.city")}
            </label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="Buenos Aires, Argentina"
              autoFocus
              className={cn(
                "w-full rounded-lg border bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-1",
                errors.city
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                  : "border-slate-700 focus:border-brand-500 focus:ring-brand-500",
              )}
            />
            {errors.city && (
              <p className="text-sm text-red-400">{errors.city}</p>
            )}
          </div>
        )}

        {/* Step 5: Bio */}
        {step === 5 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.bio")}
            </label>
            <textarea
              value={data.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="Contanos sobre vos, tu trayectoria, influencias..."
              rows={4}
              maxLength={500}
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            />
            <p className="text-xs text-slate-500 text-right">
              {data.bio.length}/500
            </p>
          </div>
        )}

        {/* Step 6: Looking For */}
        {step === 6 && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              {t("onboarding.lookingFor")}
            </label>
            <p className="text-xs text-slate-500">Opcional — podés agregar después</p>

            {data.lookingFor.map((lf, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3"
              >
                <input
                  type="text"
                  value={lf.instrument}
                  onChange={(e) =>
                    updateLookingFor(i, "instrument", e.target.value)
                  }
                  placeholder="Instrumento (opcional)"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={lf.genre}
                  onChange={(e) => updateLookingFor(i, "genre", e.target.value)}
                  placeholder="Género (opcional)"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                />
                <select
                  value={lf.role}
                  onChange={(e) =>
                    updateLookingFor(i, "role", e.target.value)
                  }
                  className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">Rol</option>
                  {COLLAB_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {tp(`role.${r.value}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLookingFor(i)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addLookingFor}
              className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              + Agregar
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        {step > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            ← {t("onboarding.back")}
          </button>
        ) : (
          <div />
        )}

        {step < STEPS - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            {t("onboarding.next")} →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={saving}
            className={cn(
              "rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-950",
              saving && "opacity-60 cursor-wait",
            )}
          >
            {saving ? t("onboarding.publishing") : t("onboarding.finish")}
          </button>
        )}
      </div>
    </div>
  );
}
