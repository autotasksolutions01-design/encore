"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface WaveformPlayerProps {
  audioUrl: string;
  waveformData: number[];
  duration?: number;
  title: string;
  clipId: string;
}

/**
 * WaveformPlayer renders a pre-computed waveform as a canvas and provides
 * audio playback via Howler.js with byte-range progressive loading.
 *
 * Dependencies: howler (Howl), canvas 2D for waveform rendering.
 * Preload="metadata" enables fast first frame (<2s target per R21).
 */
export function WaveformPlayer({
  audioUrl,
  waveformData,
  duration,
  title,
  clipId,
}: WaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const howlRef = useRef<InstanceType<typeof import("howler").Howl> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const durationRef = useRef(duration ?? 0);

  // Initialize Howler.js audio
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);

    // Dynamic import Howler to avoid SSR issues
    import("howler").then(({ Howl }) => {
      if (cancelled) return;

      const howl = new Howl({
        src: [audioUrl],
        format: ["mp3"],
        html5: true, // Use HTML5 Audio for byte-range support
        preload: "metadata", // Fast first frame per R21
        volume: 0.8,
        onload: () => {
          if (cancelled) return;
          const dur = howl.duration();
          durationRef.current = dur;
          setIsLoading(false);
        },
        onloaderror: (_id: number, _error: unknown) => {
          if (cancelled) return;
          setIsLoading(false);
          setLoadError(true);
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
        onseek: () => {
          // Position updated via RAF
        },
      });

      howlRef.current = howl;
    }).catch(() => {
      if (cancelled) return;
      setIsLoading(false);
      setLoadError(true);
    });

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      howlRef.current?.unload();
    };
  }, [audioUrl]);

  // RAF loop for playback position
  useEffect(() => {
    if (!isPlaying) return;

    const updatePosition = () => {
      const howl = howlRef.current;
      if (howl) {
        const seek = howl.seek() as number;
        setCurrentTime(seek);
      }
      rafRef.current = requestAnimationFrame(updatePosition);
    };

    rafRef.current = requestAnimationFrame(updatePosition);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying]);

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;
    const barWidth = width / waveformData.length;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = waveformData[i];
      const barHeight = Math.max(1, amplitude * height * 0.9);
      const x = i * barWidth;

      // Progress highlight
      const progress = durationRef.current > 0
        ? currentTime / durationRef.current
        : 0;
      const isPlayed = i / waveformData.length < progress;

      ctx.fillStyle = isPlayed ? "rgb(99, 102, 241)" : "rgb(71, 85, 105)";
      ctx.fillRect(
        x,
        centerY - barHeight / 2,
        Math.max(1, barWidth - 1),
        barHeight,
      );
    }
  }, [waveformData, currentTime]);

  // Redraw on resize and progress change
  useEffect(() => {
    drawWaveform();

    const handleResize = () => drawWaveform();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawWaveform]);

  // Play/pause toggle
  const togglePlayback = () => {
    const howl = howlRef.current;
    if (!howl) return;

    if (howl.playing()) {
      howl.pause();
    } else {
      howl.play();
    }
  };

  // Seek on canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const howl = howlRef.current;
    if (!canvas || !howl) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const dur = durationRef.current;
    if (dur > 0) {
      const newTime = ratio * dur;
      howl.seek(newTime);
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const displayDuration = durationRef.current || duration || 0;

  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3"
      role="region"
      aria-label={`Reproductor de audio: ${title}`}
    >
      {/* Title */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white truncate flex-1 mr-2">
          {title}
        </h4>
        <span className="text-xs text-slate-500 tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(displayDuration)}
        </span>
      </div>

      {/* Live region for playback state announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading
          ? "Cargando audio"
          : loadError
            ? "Error al cargar audio"
            : isPlaying
              ? "Reproduciendo"
              : "Pausado"}
      </div>

      {/* Waveform canvas */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-lg z-10">
            <div className="h-4 w-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {loadError ? (
          <div className="h-20 flex items-center justify-center rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-500">Error al cargar audio</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-20 rounded-lg cursor-pointer bg-slate-800/30"
            onClick={handleCanvasClick}
            role="img"
            aria-label={`Forma de onda de ${title}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                togglePlayback();
              }
            }}
          />
        )}
      </div>

      {/* Play controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayback}
          disabled={isLoading || loadError}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex-1" />

        {/* Duration display */}
        <span className="text-xs text-slate-500">
          {displayDuration > 0
            ? `${displayDuration.toFixed(1)}s`
            : isLoading
              ? "Cargando..."
              : ""}
        </span>
      </div>
    </div>
  );
}
