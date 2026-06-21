import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { transcodeAudio } from "@/lib/transcode";
import { clipUploadSchema } from "@/lib/validations/clip";
import fs from "fs/promises";
import path from "path";
import os from "os";

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = clipUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const { title, fileName } = parsed.data;

  // key is passed separately from the upload completion
  const { key } = body as { key?: string };
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing upload key" }, { status: 400 });
  }

  // Find user's profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 },
    );
  }

  // Download the uploaded file from R2
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "encore-upload-"));
  const tmpInput = path.join(tmpDir, fileName);

  try {
    const r2 = getR2Client();
    const getCommand = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    });

    const response = await r2.send(getCommand);
    if (!response.Body) {
      throw new Error("Empty response body from R2");
    }

    // Write stream to temp file
    const chunks: Uint8Array[] = [];
    const reader = response.Body as unknown as ReadableStream<Uint8Array>;
    const asyncIterable = reader[Symbol.asyncIterator]
      ? reader
      : (function* () {
          // Fallback for Node.js Readable
        })();

    // Use Node.js buffer-based approach for S3 GetObject
    const bodyBuffer = await new Response(response.Body as ReadableStream).arrayBuffer();
    await fs.writeFile(tmpInput, new Uint8Array(bodyBuffer));

    // Transcode
    const tmpOutput = path.join(tmpDir, "output");
    const result = await transcodeAudio(tmpInput, tmpOutput);

    // Read transcoded MP3 and waveform
    const mp3Buffer = await fs.readFile(result.mp3Path);
    const waveformBytes = new TextEncoder().encode(JSON.stringify(result.waveform));

    // Upload transcoded files to R2
    const transcodedKey = key.replace(/\.[^.]+$/, ".mp3");
    const waveformKey = key.replace(/\.[^.]+$/, ".json");

    const [putMp3, putWaveform] = await Promise.all([
      r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: transcodedKey,
          Body: mp3Buffer,
          ContentType: "audio/mpeg",
          ContentLength: mp3Buffer.length,
        }),
      ),
      r2.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: waveformKey,
          Body: waveformBytes,
          ContentType: "application/json",
          ContentLength: waveformBytes.length,
        }),
      ),
    ]);

    // Create AudioClip record
    const clip = await prisma.audioClip.create({
      data: {
        profileId: profile.id,
        title,
        originalKey: key,
        transcodedKey,
        waveformJson: result.waveform,
        duration: result.duration,
      },
      select: {
        id: true,
        title: true,
        transcodedKey: true,
        waveformJson: true,
        duration: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({ clip }, { status: 201 });
  } catch (error) {
    console.error("Transcode error:", error);
    return NextResponse.json(
      { error: "Upload processing failed" },
      { status: 500 },
    );
  } finally {
    // Cleanup temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
