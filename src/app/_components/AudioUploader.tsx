"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/cn";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_FORMATS = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/flac",
  "audio/aac",
  "audio/mp4",
] as const;

const ACCEPTED_EXTENSIONS = ".mp3,.wav,.flac,.aac,.m4a";
const MAX_CLIPS = 5;

type UploadStatus = "idle" | "uploading" | "complete" | "error";
type ErrorCode = "too_large" | "wrong_format" | "max_clips" | "upload_failed";

interface AudioUploaderProps {
  profileId: string;
  clipCount: number;
  onUploadComplete?: (clip: { id: string; title: string }) => void;
}

export function AudioUploader({
  profileId,
  clipCount,
  onUploadComplete,
}: AudioUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<{ code: ErrorCode; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atMaxClips = clipCount >= MAX_CLIPS;

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!atMaxClips && uploadStatus !== "uploading") {
        setIsDragging(true);
      }
    },
    [atMaxClips, uploadStatus],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (atMaxClips) {
        setError({
          code: "max_clips",
          message: `Máximo ${MAX_CLIPS} clips alcanzado. Eliminá uno antes de subir otro.`,
        });
        return;
      }

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [atMaxClips],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = async (file: File) => {
    setError(null);
    setUploadStatus("idle");

    // Client-side 5MB check
    if (file.size > MAX_FILE_SIZE) {
      setError({
        code: "too_large",
        message: `El archivo excede los 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      });
      setUploadStatus("error");
      return;
    }

    // Client-side format check
    if (!ACCEPTED_FORMATS.includes(file.type as (typeof ACCEPTED_FORMATS)[number])) {
      setError({
        code: "wrong_format",
        message: "Formato no soportado. Usá MP3, WAV, FLAC o AAC.",
      });
      setUploadStatus("error");
      return;
    }

    // Extract title from filename (remove extension)
    const title = file.name.replace(/\.[^/.]+$/, "");

    try {
      setUploadStatus("uploading");
      setUploadProgress(10);

      // Step 1: Get pre-signed URL
      const presignedRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fileSize: file.size,
          contentType: file.type,
          fileName: file.name,
        }),
      });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        if (presignedRes.status === 429 && errData.code === "MAX_CLIPS") {
          setError({
            code: "max_clips",
            message: `Máximo ${MAX_CLIPS} clips alcanzado.`,
          });
        } else {
          setError({
            code: "upload_failed",
            message: errData.error ?? "Error al preparar la subida.",
          });
        }
        setUploadStatus("error");
        return;
      }

      const { uploadUrl, key } = (await presignedRes.json()) as {
        uploadUrl: string;
        key: string;
      };

      setUploadProgress(30);

      // Step 2: Upload directly to R2 via pre-signed URL
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
        },
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`);
      }

      setUploadProgress(70);

      // Step 3: Trigger transcode
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          fileSize: file.size,
          contentType: file.type,
          fileName: file.name,
          key,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Transcode failed");
      }

      setUploadProgress(100);
      setUploadStatus("complete");

      const { clip } = (await completeRes.json()) as {
        clip: { id: string; title: string };
      };

      onUploadComplete?.(clip);

      // Reset after 2s
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadProgress(0);
      }, 2000);
    } catch (err) {
      setError({
        code: "upload_failed",
        message:
          err instanceof Error ? err.message : "Error desconocido al subir.",
      });
      setUploadStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (!atMaxClips && uploadStatus !== "uploading") {
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragging && "border-brand-400 bg-brand-500/10",
          !isDragging && "border-slate-700 hover:border-slate-500",
          atMaxClips && "border-slate-800 opacity-50 cursor-not-allowed",
          uploadStatus === "uploading" && "cursor-wait",
        )}
        role="button"
        tabIndex={0}
        aria-label="Subir audio"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!atMaxClips && uploadStatus !== "uploading") {
              fileInputRef.current?.click();
            }
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          disabled={atMaxClips || uploadStatus === "uploading"}
        />

        {/* Upload icon */}
        <div className="mb-3 text-slate-500">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 16V4m0 0L8 8m4-4l4 4M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"
            />
          </svg>
        </div>

        {atMaxClips && uploadStatus !== "uploading" ? (
          <p className="text-sm text-slate-500">
            Máximo {MAX_CLIPS} clips alcanzado
          </p>
        ) : uploadStatus === "idle" ? (
          <>
            <p className="text-sm text-slate-400">
              Arrastrá un audio o hace clic para seleccionar
            </p>
            <p className="text-xs text-slate-600 mt-1">
              MP3, WAV, FLAC, AAC — Máximo 5MB
            </p>
          </>
        ) : null}

        {/* Upload progress */}
        {uploadStatus === "uploading" && (
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Subiendo...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Success state */}
        {uploadStatus === "complete" && (
          <p className="text-sm text-green-400">¡Subido con éxito!</p>
        )}
      </div>

      {/* Error display */}
      {error && uploadStatus === "error" && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3">
          <p className="text-sm text-red-400">
            {error.code === "max_clips"
              ? `Máximo ${MAX_CLIPS} clips alcanzado. Eliminá uno antes de subir otro.`
              : error.message}
          </p>
        </div>
      )}

      {/* Clip count indicator */}
      <p className="text-xs text-slate-600 text-right">
        {clipCount}/{MAX_CLIPS} clips
      </p>
    </div>
  );
}
