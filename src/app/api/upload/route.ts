import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { clipUploadSchema } from "@/lib/validations/clip";

const MAX_CLIPS = 5;

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

  const { title, fileSize, contentType, fileName } = parsed.data;

  // Find user's profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found. Create a profile first." },
      { status: 404 },
    );
  }

  // Max 5 clips gate (R17, R22)
  const clipCount = await prisma.audioClip.count({
    where: { profileId: profile.id },
  });

  if (clipCount >= MAX_CLIPS) {
    return NextResponse.json(
      {
        error: `Max ${MAX_CLIPS} clips reached. Delete a clip before uploading a new one.`,
        code: "MAX_CLIPS",
      },
      { status: 429 },
    );
  }

  // Generate unique key for R2
  const ext = fileName.split(".").pop() ?? "mp3";
  const key = `clips/${profile.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  try {
    const r2 = getR2Client();
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 });

    return NextResponse.json({
      uploadUrl,
      key,
      expiresIn: 60,
    });
  } catch (error) {
    console.error("R2 presigned URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}
