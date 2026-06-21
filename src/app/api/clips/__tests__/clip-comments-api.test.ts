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
  audioClip: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  clipComment: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

// Dynamic imports after mocks — all at top level
const authModule = await import("@/lib/auth");
const { GET: getComments, POST: postComment } = await import(
  "../[id]/comments/route"
);
const { DELETE: deleteClip } = await import("../[id]/route");

describe("Clip Comments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/clips/[id]/comments", () => {
    it("returns 404 when clip not found", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);
      prismaMock.audioClip.findUnique.mockResolvedValue(null);

      const result = await getComments(
        new Request("http://localhost/api/clips/nonexistent/comments"),
        { params: Promise.resolve({ id: "nonexistent" }) },
      );

      expect(result.status).toBe(404);
    });

    it("returns comments for valid clip (public access)", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);
      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profileId: "profile-1",
      });

      const mockComments = [
        {
          id: "comment-1",
          text: "¡Excelente solo!",
          createdAt: new Date(),
          authorId: "user-2",
        },
        {
          id: "comment-2",
          text: "Muy bueno",
          createdAt: new Date(),
          authorId: "user-3",
        },
      ];

      prismaMock.clipComment.findMany.mockResolvedValue(mockComments);

      const result = await getComments(
        new Request("http://localhost/api/clips/clip-1/comments"),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(200);
      const data = await result.json();
      expect(data.comments).toHaveLength(2);
      expect(data.comments[0].text).toBe("¡Excelente solo!");
    });

    it("returns empty array for clip with no comments", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);
      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profileId: "profile-1",
      });
      prismaMock.clipComment.findMany.mockResolvedValue([]);

      const result = await getComments(
        new Request("http://localhost/api/clips/clip-1/comments"),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(200);
      const data = await result.json();
      expect(data.comments).toHaveLength(0);
    });
  });

  describe("POST /api/clips/[id]/comments", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);

      const result = await postComment(
        new Request("http://localhost/api/clips/clip-1/comments", {
          method: "POST",
          body: JSON.stringify({ text: "Great!" }),
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(401);
    });

    it("returns 404 when clip not found", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-2", email: "test@test.com" },
      } as never);
      prismaMock.audioClip.findUnique.mockResolvedValue(null);

      const result = await postComment(
        new Request("http://localhost/api/clips/clip-1/comments", {
          method: "POST",
          body: JSON.stringify({ text: "Great!" }),
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(404);
    });

    it("returns 422 for empty comment text", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-2", email: "test@test.com" },
      } as never);
      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profileId: "profile-1",
      });

      const result = await postComment(
        new Request("http://localhost/api/clips/clip-1/comments", {
          method: "POST",
          body: JSON.stringify({ text: "" }),
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(422);
    });

    it("returns 422 for comment exceeding 500 chars", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-2", email: "test@test.com" },
      } as never);
      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profileId: "profile-1",
      });

      const result = await postComment(
        new Request("http://localhost/api/clips/clip-1/comments", {
          method: "POST",
          body: JSON.stringify({ text: "x".repeat(501) }),
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(422);
    });

    it("creates comment for valid input", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-2", email: "test@test.com" },
      } as never);
      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profileId: "profile-1",
      });

      const createdComment = {
        id: "comment-new",
        text: "¡Gran sonido!",
        createdAt: new Date(),
        authorId: "user-2",
      };

      prismaMock.clipComment.create.mockResolvedValue(createdComment);

      const result = await postComment(
        new Request("http://localhost/api/clips/clip-1/comments", {
          method: "POST",
          body: JSON.stringify({ text: "¡Gran sonido!" }),
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(201);
      const data = await result.json();
      expect(data.comment.text).toBe("¡Gran sonido!");
      expect(data.comment.authorId).toBe("user-2");
    });
  });

  describe("DELETE /api/clips/[id]", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(authModule.auth).mockResolvedValue(null);

      const result = await deleteClip(
        new Request("http://localhost/api/clips/clip-1", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(401);
    });

    it("returns 404 when clip not found", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      } as never);
      prismaMock.audioClip.findUnique.mockResolvedValue(null);

      const result = await deleteClip(
        new Request("http://localhost/api/clips/clip-1", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(404);
    });

    it("returns 403 when not owner", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-2", email: "other@test.com" },
      } as never);

      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profile: { userId: "user-1" },
      });

      const result = await deleteClip(
        new Request("http://localhost/api/clips/clip-1", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(403);
    });

    it("deletes clip when owner", async () => {
      vi.mocked(authModule.auth).mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
      } as never);

      prismaMock.audioClip.findUnique.mockResolvedValue({
        id: "clip-1",
        profile: { userId: "user-1" },
      });

      prismaMock.$transaction.mockImplementation(
        async (fn: unknown[]) => fn,
      );

      const result = await deleteClip(
        new Request("http://localhost/api/clips/clip-1", {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: "clip-1" }) },
      );

      expect(result.status).toBe(200);
      const data = await result.json();
      expect(data.deleted).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });
});
