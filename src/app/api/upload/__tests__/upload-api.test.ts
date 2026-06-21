import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Next.js server
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: unknown, init?: ResponseInit) => ({
      ...init,
      body,
      json: () => Promise.resolve(body),
      status: init?.status ?? 200,
    })),
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
const prismaMock = {
  profile: { findUnique: vi.fn() },
  audioClip: { count: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

// Mock S3 — use function constructor so `new S3Client()` works
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function S3Client() {
    return { send: vi.fn() };
  },
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

const authModule = await import("@/lib/auth");
const { POST } = await import("../route");

describe("Upload API — POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    title: "Mi Solo de Guitarra",
    fileSize: 3 * 1024 * 1024,
    contentType: "audio/mpeg",
    fileName: "solo.mp3",
  };

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(authModule.auth).mockResolvedValue(null);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(result.status).toBe(401);
  });

  it("returns 404 when profile not found", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    prismaMock.profile.findUnique.mockResolvedValue(null);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(result.status).toBe(404);
  });

  it("returns 429 when max clips reached (5 clips)", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    prismaMock.audioClip.count.mockResolvedValue(5);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(result.status).toBe(429);
    const data = await result.json();
    expect(data.code).toBe("MAX_CLIPS");
  });

  it("returns 422 for invalid body (missing fields)", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify({ title: "" }),
      }),
    );

    expect(result.status).toBe(422);
  });

  it("returns 422 for file exceeding 5MB", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          fileSize: 6 * 1024 * 1024,
        }),
      }),
    );

    expect(result.status).toBe(422);
  });

  it("returns 422 for invalid content type", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          contentType: "image/png",
        }),
      }),
    );

    expect(result.status).toBe(422);
  });

  it("rejects non-audio content types", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify({
          ...validBody,
          contentType: "application/zip",
        }),
      }),
    );

    expect(result.status).toBe(422);
  });

  it("generates pre-signed URL when under clip limit", async () => {
    vi.mocked(authModule.auth).mockResolvedValue({
      user: { id: "user-1", email: "test@test.com" },
    } as never);

    prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-1" });
    prismaMock.audioClip.count.mockResolvedValue(3);

    // Reset the S3 and presigner mocks, then stub getSignedUrl for this test
    const { getSignedUrl } = await import(
      "@aws-sdk/s3-request-presigner"
    );
    vi.mocked(getSignedUrl).mockResolvedValue(
      "https://r2.example.com/presigned-url",
    );

    const result = await POST(
      new Request("http://localhost/api/upload", {
        method: "POST",
        body: JSON.stringify(validBody),
      }),
    );

    expect(result.status).toBe(200);
    const data = await result.json();
    expect(data.uploadUrl).toBe("https://r2.example.com/presigned-url");
    expect(data.key).toBeDefined();
    expect(data.key).toContain("profile-1");
    expect(data.expiresIn).toBe(60);
  });
});
