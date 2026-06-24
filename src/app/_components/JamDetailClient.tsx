"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { JamResponseType } from "@prisma/client";

interface AudioClipData {
  id: string;
  title: string;
  audioUrl: string;
  waveformData: number[];
  duration: number | null;
}

interface OrganizerData {
  id: string;
  displayName: string;
  instruments: string[];
  skillLevel: string;
  city: string;
  audioClips: AudioClipData[];
}

interface LineupMember {
  id: string;
  profileId: string | null;
  name: string;
  displayName: string;
  instruments: string[];
  skillLevel: string;
  response: "interested" | "going";
}

interface JamDetailClientProps {
  id: string;
  title: string;
  genre: string;
  description: string | null;
  formattedDate: string;
  formattedTime: string;
  locationName: string;
  status: string;
  isCreator: boolean;
  isAuthenticated: boolean;
  canRespond: boolean;
  isExpired: boolean;
  userResponse: JamResponseType | null;
  organizer: OrganizerData;
  lineup: LineupMember[];
  responseCount: number;
  cancelAction: () => void;
}

const SKILL_STYLES: Record<string, string> = {
  beginner: "bg-slate-800 text-slate-300 border-slate-700",
  intermediate: "bg-blue-900/30 text-blue-300 border-blue-800",
  advanced: "bg-purple-900/30 text-purple-300 border-purple-800",
  pro: "bg-amber-900/30 text-amber-300 border-amber-800",
};

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  pro: "Pro",
};

function OrganizerAudioPreview({ clips }: { clips: AudioClipData[] }) {
  const clip = clips[0];
  if (!clip || !clip.audioUrl) return null;

  return <AudioPreview clip={clip} />;
}

function AudioPreview({ clip }: { clip: AudioClipData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const howlRef = useRef<InstanceType<typeof import("howler").Howl> | null>(null);
  const rafRef = useRef<number>(0);
  const durationRef = useRef(clip.duration ?? 0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    import("howler").then(({ Howl }) => {
      if (cancelled) return;
      const howl = new Howl({
        src: [clip.audioUrl],
        format: ["mp3"],
        html5: true,
        preload: "metadata",
        volume: 0.8,
        onload: () => {
          if (cancelled) return;
          durationRef.current = howl.duration();
          setIsLoading(false);
        },
        onloaderror: () => {
          if (cancelled) return;
          setIsLoading(false);
        },
        onplay: () => {
          if (cancelled) return;
          setIsPlaying(true);
        },
        onpause: () => {
          if (cancelled) return;
          setIsPlaying(false);
        },
        onstop: () => {
          if (cancelled) return;
          setIsPlaying(false);
          setCurrentTime(0);
        },
        onend: () => {
          if (cancelled) return;
          setIsPlaying(false);
          setCurrentTime(0);
        },
      });
      howlRef.current = howl;
    }).catch(() => {
      if (cancelled) return;
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      howlRef.current?.unload();
    };
  }, [clip.audioUrl]);

  useEffect(() => {
    if (!isPlaying) return;
    const update = () => {
      const h = howlRef.current;
      if (h) setCurrentTime(h.seek() as number);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);

  const togglePlay = () => {
    const h = howlRef.current;
    if (!h) return;
    h.playing() ? h.pause() : h.play();
  };

  const waveform = clip.waveformData ?? [];
  const dur = durationRef.current || clip.duration || 0;
  const progress = dur > 0 ? currentTime / dur : 0;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-[13px] bg-[#1d2330]">
      <button
        onClick={togglePlay}
        disabled={isLoading || !clip.audioUrl}
        className="w-[38px] h-[38px] rounded-full bg-brand-500 text-white hover:bg-brand-400 flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={isPlaying ? "Pausar" : "Reproducir demo"}
      >
        {isLoading ? (
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-[550] text-slate-200 mb-[5px] truncate">
          {clip.title}
        </div>
        <div className="relative flex items-center gap-[2px] h-[26px] overflow-hidden">
          {waveform.length > 0
            ? waveform.map((amp, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[2px]"
                  style={{
                    height: `${Math.max(4, amp * 24)}px`,
                    backgroundColor:
                      i / waveform.length < progress
                        ? "rgb(92, 124, 250)"
                        : "rgba(150, 160, 180, 0.4)",
                  }}
                />
              ))
            : Array.from({ length: 34 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[2px]"
                  style={{
                    height: `${8 + Math.random() * 16}px`,
                    backgroundColor: "rgba(150, 160, 180, 0.4)",
                  }}
                />
              ))}
        </div>
      </div>
      <span className="text-[11.5px] text-[#6b7785] flex-shrink-0">
        {dur > 0 ? formatDuration(dur) : "--:--"}
      </span>
    </div>
  );
}

function RespondStickyBar({
  jamId,
  currentResponse,
  isAuthenticated,
  canRespond,
  isExpired,
}: {
  jamId: string;
  currentResponse: JamResponseType | null;
  isAuthenticated: boolean;
  canRespond: boolean;
  isExpired: boolean;
}) {
  const [response, setResponse] = useState<JamResponseType | null>(currentResponse);
  const [sending, setSending] = useState(false);

  const handleRespond = async (type: JamResponseType) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/jams/${jamId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: type }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to respond:", data.error);
        return;
      }
      setResponse(type);
    } catch (err) {
      console.error("Failed to respond:", err);
    } finally {
      setSending(false);
    }
  };

  const intActive = response === "interested";
  const goActive = response === "going";

  return (
    <div
      className="sticky bottom-0 -mx-4 px-4 pt-[13px] pb-[6px] z-10"
      style={{
        background: "linear-gradient(to top, #0d1117 70%, transparent)",
      }}
    >
      {isAuthenticated && canRespond ? (
        <div className="flex gap-[10px]">
          <button
            onClick={() => handleRespond("interested")}
            disabled={sending}
            aria-pressed={intActive}
            aria-label="Me interesa"
            className={cn(
              "flex-1 py-[14px] rounded-[14px] text-[14.5px] font-semibold transition-colors",
              intActive
                ? "bg-slate-600 text-white border border-slate-500"
                : "bg-transparent text-slate-300 border border-slate-700 hover:border-slate-600",
              sending && "opacity-50 cursor-not-allowed",
            )}
          >
            Me interesa
          </button>
          <button
            onClick={() => handleRespond("going")}
            disabled={sending}
            aria-pressed={goActive}
            aria-label="Voy"
            className={cn(
              "flex-1 py-[14px] rounded-[14px] text-[14.5px] font-semibold transition-colors",
              goActive
                ? "bg-brand-600 text-white"
                : "bg-brand-500 text-white hover:bg-brand-600",
              sending && "opacity-50 cursor-not-allowed",
            )}
            style={
              !goActive
                ? { boxShadow: "0 6px 18px rgba(92, 124, 250, 0.35)" }
                : undefined
            }
          >
            Voy
          </button>
        </div>
      ) : response ? (
        <div className="flex gap-[10px]">
          <button
            disabled
            aria-pressed={intActive}
            aria-label="Me interesa"
            className={cn(
              "flex-1 py-[14px] rounded-[14px] text-[14.5px] font-semibold",
              intActive
                ? "bg-slate-600 text-white border border-slate-500"
                : "bg-transparent text-slate-600 border border-slate-800",
              "cursor-default",
            )}
          >
            Me interesa
          </button>
          <button
            disabled
            aria-pressed={goActive}
            aria-label="Voy"
            className={cn(
              "flex-1 py-[14px] rounded-[14px] text-[14.5px] font-semibold",
              goActive
                ? "bg-brand-600 text-white"
                : "bg-slate-800 text-slate-600",
              "cursor-default",
            )}
          >
            Voy
          </button>
        </div>
      ) : !isAuthenticated ? (
        <p className="text-center text-[13px] text-slate-500 py-[10px]">
          Iniciá sesión para responder
        </p>
      ) : isExpired ? (
        <p className="text-center text-[13px] text-slate-500 py-[10px]">
          Esta jam ya no acepta respuestas
        </p>
      ) : null}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-brand-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function JamDetailClient({
  id,
  title,
  genre,
  description,
  formattedDate,
  formattedTime,
  locationName,
  status,
  isCreator,
  isAuthenticated,
  canRespond,
  isExpired,
  userResponse,
  organizer,
  lineup,
  responseCount,
  cancelAction,
}: JamDetailClientProps) {
  const isActive = status === "active";

  return (
    <div className="max-w-3xl" style={{ paddingBottom: 90 }}>
      <Link
        href="/es/jams"
        className="inline-flex items-center gap-[6px] text-[13.5px] text-[#9aa7b5] hover:text-white transition-colors mb-[18px]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Jams
      </Link>

      {/* Header chips */}
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-brand-500/14 text-brand-400 text-xs font-semibold px-[11px] py-[4px] rounded-full capitalize">
          {genre}
        </span>
        {isActive && (
          <span className="inline-flex items-center gap-[6px] bg-green-500/16 text-green-400 text-xs font-semibold px-[11px] py-[4px] rounded-full">
            <span className="w-[6px] h-[6px] rounded-full bg-green-400" />
            Activa
          </span>
        )}
        {status === "cancelled" && (
          <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-[11px] py-[4px] rounded-full">
            Cancelada
          </span>
        )}
        {status === "expired" && (
          <span className="bg-slate-500/20 text-slate-400 text-xs font-semibold px-[11px] py-[4px] rounded-full">
            Expirada
          </span>
        )}
      </div>

      {/* Title + creator actions */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-white font-bold text-[27px] tracking-[-0.6px] leading-[1.15]">
          {title}
        </h1>
        {isCreator && isActive && (
          <form action={cancelAction}>
            <button
              type="submit"
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            >
              Cancelar jam
            </button>
          </form>
        )}
      </div>

      {description && (
        <p className="text-[#9aa7b5] text-[15px] leading-[1.55] mb-5">
          {description}
        </p>
      )}

      {/* When / Where cards */}
      <div className="flex gap-3 mb-[18px] flex-wrap">
        <div className="flex-1 min-w-[150px] flex gap-3 items-center p-[14px] rounded-[15px] bg-[#161b22] border border-[#2a3140]">
          <div className="w-10 h-10 rounded-[11px] bg-brand-500/14 text-brand-400 flex items-center justify-center flex-shrink-0">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{formattedDate}</div>
            <div className="text-[12.5px] text-[#9aa7b5]">{formattedTime} hs</div>
          </div>
        </div>
        <div className="flex-1 min-w-[150px] flex gap-3 items-center p-[14px] rounded-[15px] bg-[#161b22] border border-[#2a3140]">
          <div className="w-10 h-10 rounded-[11px] bg-brand-500/14 text-brand-400 flex items-center justify-center flex-shrink-0">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{locationName}</div>
          </div>
        </div>
      </div>

      {/* Organizer decision card */}
      <div className="p-4 rounded-[16px] bg-[#161b22] border border-[#2a3140] mb-[18px]">
        <div className="text-[11px] uppercase tracking-[0.7px] text-[#6b7785] mb-3">
          Organiza
        </div>
        <div className="flex items-center gap-3 mb-[14px]">
          <div className="w-[46px] h-[46px] rounded-full bg-brand-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
            {organizer.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/es/profile/${organizer.id}`}
              className="font-semibold text-[15.5px] text-white hover:text-brand-400 transition-colors"
            >
              {organizer.displayName}
            </Link>
            <div className="text-[13px] text-[#9aa7b5]">
              {organizer.instruments.join(", ")}
              {organizer.city ? ` · ${organizer.city}` : ""}
            </div>
          </div>
          <span
            className={cn(
              "text-[11px] font-semibold px-[10px] py-[4px] rounded-full flex-shrink-0",
              SKILL_STYLES[organizer.skillLevel] ?? SKILL_STYLES.beginner,
            )}
          >
            {SKILL_LABELS[organizer.skillLevel] ?? organizer.skillLevel}
          </span>
        </div>
        <OrganizerAudioPreview clips={organizer.audioClips} />
      </div>

      {/* Lineup (responses) */}
      <div className="p-4 rounded-[16px] bg-[#161b22] border border-[#2a3140]">
        <div className="flex items-center justify-between mb-[14px]">
          <div className="font-semibold text-[15px] text-white">
            {responseCount > 0
              ? `Van ${responseCount} ${responseCount === 1 ? "músico" : "músicos"}`
              : "Sin respuestas"}
          </div>
          {responseCount > 0 && (
            <span className="text-xs text-[#6b7785]">
              {lineup.filter((m) => m.response === "going").length} confirman
            </span>
          )}
        </div>

        {lineup.length === 0 && (
          <div className="text-[13px] text-[#9aa7b5] py-3 text-center">
            {isExpired
              ? "Esta jam ya no acepta respuestas."
              : isAuthenticated
                ? "Sé el primero en responder."
                : "Iniciá sesión para responder."}
          </div>
        )}

        {lineup.length > 0 && (
          <div className="flex flex-col gap-[10px]">
            {lineup.map((member, i) => (
              <div key={member.id} className="flex items-center gap-[11px]">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0",
                    getAvatarColor(i),
                  )}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {member.profileId ? (
                    <Link
                      href={`/es/profile/${member.profileId}`}
                      className="text-sm font-[550] text-white hover:text-brand-400 transition-colors"
                    >
                      {member.displayName}
                    </Link>
                  ) : (
                    <span className="text-sm font-[550] text-white">
                      {member.displayName}
                    </span>
                  )}
                  <div className="text-xs text-[#9aa7b5]">
                    {member.instruments.length > 0
                      ? member.instruments.join(", ")
                      : "Sin instrumentos"}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    member.response === "going"
                      ? "text-brand-400"
                      : "text-[#9aa7b5]",
                  )}
                >
                  {member.response === "going" ? "Voy" : "Me interesa"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky respond bar */}
      <RespondStickyBar
        jamId={id}
        currentResponse={userResponse}
        isAuthenticated={isAuthenticated}
        canRespond={canRespond}
        isExpired={isExpired}
      />
    </div>
  );
}
