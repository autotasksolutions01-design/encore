import { describe, it, expect, vi, beforeEach } from "vitest";

function NextResponseMock(body: BodyInit | null, init?: ResponseInit) {
  return {
    body,
    status: init?.status ?? 200,
    json: () => (body ? Promise.resolve(JSON.parse(body as string)) : Promise.resolve(null)),
  };
}
NextResponseMock.json = vi.fn((body: unknown, init?: ResponseInit) => ({
  body,
  status: init?.status ?? 200,
  json: () => Promise.resolve(body),
}));
vi.mock("next/server", () => ({
  NextRequest: vi.fn(),
  NextResponse: NextResponseMock,
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

const prismaMock = {
  user: {
    findUnique: vi.fn(),
  },
  block: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { POST, DELETE } = await import("../route");

describe("Block/Unblock API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/blocks", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const req = new Request("http://localhost/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId: "user-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(401);
    });

    it("returns 400 when trying to block self", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      const req = new Request("http://localhost/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId: "user-1" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(400);
    });

    it("blocks a user successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-2" });
      prismaMock.block.findUnique.mockResolvedValue(null);
      prismaMock.block.create.mockResolvedValue({
        id: "block-1",
        userId: "user-1",
        blockedUserId: "user-2",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId: "user-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(201);
      expect((res as { body: { blocked: boolean } }).body.blocked).toBe(true);
    });

    it("returns 200 if already blocked", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.user.findUnique.mockResolvedValue({ id: "user-2" });
      prismaMock.block.findUnique.mockResolvedValue({
        id: "block-1",
        userId: "user-1",
        blockedUserId: "user-2",
      });

      const req = new Request("http://localhost/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId: "user-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(200);
      expect((res as { body: { alreadyBlocked: boolean } }).body.alreadyBlocked).toBe(true);
    });

    it("returns 404 when target user not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.user.findUnique.mockResolvedValue(null);

      const req = new Request("http://localhost/api/blocks", {
        method: "POST",
        body: JSON.stringify({ userId: "user-999" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/blocks", () => {
    it("unblocks a user successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.block.delete.mockResolvedValue({});

      const req = new Request("http://localhost/api/blocks", {
        method: "DELETE",
        body: JSON.stringify({ userId: "user-2" }),
      });

      const res = await DELETE(req as never);
      expect(res.status).toBe(200);
      expect((res as { body: { unblocked: boolean } }).body.unblocked).toBe(true);
    });

    it("returns 404 when block not found", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.block.delete.mockRejectedValue(
        new Error("Record not found"),
      );

      const req = new Request("http://localhost/api/blocks", {
        method: "DELETE",
        body: JSON.stringify({ userId: "user-999" }),
      });

      const res = await DELETE(req as never);
      expect(res.status).toBe(404);
    });
  });
});
