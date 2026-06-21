import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import os from "os";

const execFileAsync = promisify(execFile);

export interface TranscodeResult {
  mp3Path: string;
  waveform: number[];
  duration: number;
}

/**
 * Generate an 800-point waveform from an audio file using FFmpeg's compand filter.
 * Falls back to a flat-zero waveform if FFmpeg is unavailable.
 */
async function generateWaveform(inputPath: string): Promise<number[]> {
  try {
    // Use FFmpeg to extract RMS envelope: compand → volumedetect → raw samples
    const tmpFile = path.join(os.tmpdir(), `encore-waveform-${Date.now()}.raw`);
    await execFileAsync("ffmpeg", [
      "-i", inputPath,
      "-af", "compand=attacks=0:decays=0:points=-80/-80|0/0,aresample=800,asetnsamples=1",
      "-f", "f64le",
      "-y",
      tmpFile,
    ], { timeout: 15000 });

    const buffer = await fs.readFile(tmpFile);
    await fs.unlink(tmpFile).catch(() => {});

    // Parse raw 64-bit float samples into normalized 0-1 values
    const samples = new Float64Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / 8,
    );
    const waveform = Array.from(samples.slice(0, 800)).map((v) => {
      const abs = Math.abs(v);
      // Normalize: clamp to 0-1
      return Math.min(1, Math.max(0, abs));
    });

    // Pad to exactly 800 points
    while (waveform.length < 800) {
      waveform.push(0);
    }

    return waveform;
  } catch {
    // Return flat zero waveform on failure
    return new Array(800).fill(0);
  }
}

/**
 * Get audio duration using ffprobe or FFmpeg.
 */
async function getDuration(inputPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ], { timeout: 10000 });
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Transcode audio to 128kbps MP3 mono and generate an 800-point waveform.
 *
 * Strategy:
 * 1. Primary: ffmpeg-static (binary in node_modules)
 * 2. Fallback: system `ffmpeg` on PATH
 * 3. Last resort: @ffmpeg/ffmpeg WASM (installed separately)
 *
 * For MVP, only the system FFmpeg approach is implemented.
 * WASM fallback can be added when @ffmpeg/ffmpeg is installed.
 */
export async function transcodeAudio(
  inputPath: string,
  outputDir: string,
): Promise<TranscodeResult> {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const mp3Path = path.join(outputDir, `${baseName}.mp3`);

  const ffmpegPath = await resolveFfmpegPath();

  // Transcode to 128kbps MP3 mono
  await execFileAsync(ffmpegPath, [
    "-i", inputPath,
    "-codec:a", "libmp3lame",
    "-b:a", "128k",
    "-ac", "1",
    "-ar", "44100",
    "-y",
    mp3Path,
  ], { timeout: 30000 });

  // Generate waveform from the transcoded MP3
  const waveform = await generateWaveform(mp3Path);

  // Get duration
  const duration = await getDuration(mp3Path);

  return { mp3Path, waveform, duration };
}

/**
 * Fallback transcode for when native FFmpeg is not available.
 * Uses @ffmpeg/ffmpeg WASM in browser/Node.
 * Placeholder — requires @ffmpeg/ffmpeg npm package.
 */
export async function transcodeAudioWasm(
  _inputPath: string,
  _outputDir: string,
): Promise<TranscodeResult> {
  throw new Error(
    "WASM FFmpeg fallback not yet configured. Install @ffmpeg/ffmpeg package.",
  );
}

/**
 * Resolve an FFmpeg binary path, trying:
 * 1. ffmpeg-static from node_modules
 * 2. System ffmpeg on PATH
 */
export async function resolveFfmpegPath(): Promise<string> {
  try {
    // Try ffmpeg-static first
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — ffmpeg-static is optional, may not be installed
    const ffmpegStatic = await import("ffmpeg-static");
    if (ffmpegStatic.default) {
      return ffmpegStatic.default as string;
    }
  } catch {
    // ffmpeg-static not installed — fall through
  }

  // Check system PATH
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
    return "ffmpeg";
  } catch {
    throw new Error(
      "FFmpeg not found. Install ffmpeg-static or add ffmpeg to PATH.",
    );
  }
}
