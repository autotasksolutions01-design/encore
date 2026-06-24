"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface AudioClipData {
  id: string;
  title: string;
  audioUrl: string;
  waveformData: number[];
  duration: number | null;
}

interface ProfileCardProps {
  id: string;
  displayName: string;
  instruments: string[];
  genres: string[];
  skillLevel: string;
  city: string;
  avatarUrl?: string | null;
  className?: string;
  distanceKm?: number;
  audioClips?: AudioClipData[];
}

const MAX_INSTRUMENTS = 3;
const MAX_GENRES = 2;

const SKILL_STYLES: Record<string, string> = {
  beginner: "bg-slate-700 text-slate-300 border-slate-600",
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

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={togglePlay}
        disabled={isLoading || !clip.audioUrl}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label={isPlaying ? "Pausar" : "Reproducir"}
      >
        {isLoading ? (
          <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="ml-0.5 h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1 h-7 rounded bg-slate-800/50 overflow-hidden relative">
        <div className="absolute inset-0 flex items-center gap-px px-0.5">
          {waveform.length > 0
            ? waveform.map((amp, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max(8, amp * 24)}px`,
                    backgroundColor:
                      i / waveform.length < progress
                        ? "rgb(99, 102, 241)"
                        : "rgb(71, 85, 105)",
                  }}
                />
              ))
            : (
              <div className="flex items-center justify-center w-full text-[10px] text-slate-600">
                {clip.title}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

export function ProfileCard({
  id,
  displayName,
  instruments,
  genres,
  skillLevel,
  city,
  avatarUrl,
  className,
  distanceKm,
  audioClips = [],
}: ProfileCardProps) {
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectSent, setConnectSent] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const instrumentDisplay = instruments.slice(0, MAX_INSTRUMENTS);
  const instrumentOverflow = instruments.length - MAX_INSTRUMENTS;
  const genreDisplay = genres.slice(0, MAX_GENRES);
  const genreOverflow = genres.length - MAX_GENRES;
  const skillStyle =
    SKILL_STYLES[skillLevel] ?? SKILL_STYLES.beginner;
  const skillLabel =
    SKILL_LABELS[skillLevel] ?? skillLevel;

  const firstClip = audioClips[0];

  const handleConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConnectLoading(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: id }),
      });
      if (res.status === 409) {
        setConnectError("Ya enviado. Esperá antes de reintentar.");
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al conectar");
      } else {
        setConnectSent(true);
      }
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Algo salió mal",
      );
    } finally {
      setConnectLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "block rounded-xl border border-slate-800 bg-slate-900 p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/10 hover:border-slate-600 hover:bg-slate-800/50",
        className,
      )}
    >
      <Link href={`/es/profile/${id}`} className="block">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-14 w-14 rounded-full border-2 border-slate-700 object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-500">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white truncate">
              {displayName}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">{city}</p>
            {distanceKm !== undefined && (
              <p className="text-xs text-slate-500 mt-0.5">
                {distanceKm.toFixed(1)} km
              </p>
            )}

            <div className="mt-2">
              <span
                className={cn(
                  "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  skillStyle,
                )}
              >
                {skillLabel}
              </span>
            </div>

            {instruments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {instrumentDisplay.map((inst) => (
                  <span
                    key={inst}
                    className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300"
                  >
                    {inst}
                  </span>
                ))}
                {instrumentOverflow > 0 && (
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500">
                    +{instrumentOverflow}
                  </span>
                )}
              </div>
            )}

            {genres.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {genreDisplay.map((genre) => (
                  <span
                    key={genre}
                    className="text-xs text-slate-500"
                  >
                    {genre}
                  </span>
                ))}
                {genreOverflow > 0 && (
                  <span className="text-xs text-slate-600">
                    +{genreOverflow}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {firstClip && firstClip.audioUrl && (
        <AudioPreview clip={firstClip} />
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={handleConnect}
          disabled={connectLoading || connectSent}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
            connectSent
              ? "border-green-700 bg-green-900/30 text-green-400 cursor-default"
              : "border-slate-700 text-slate-300 hover:bg-brand-600/20 hover:text-brand-400 hover:border-brand-600/50",
            connectLoading && "opacity-60 cursor-wait",
          )}
        >
          {connectLoading
            ? "Enviando..."
            : connectSent
              ? "Enviado ✓"
              : "Conectar"}
        </button>
        {connectError && (
          <span className="text-[10px] text-red-400">{connectError}</span>
        )}
      </div>
    </div>
  );
}
