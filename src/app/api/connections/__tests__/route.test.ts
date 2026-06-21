import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Next.js server
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

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

// Mock prisma
const prismaMock = {
  profile: {
    findUnique: vi.fn(),
  },
  connection: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  block: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { POST } = await import("../route");
const { PATCH, DELETE } = await import("../[id]/route");

describe("Connections API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/connections — express interest", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("returns 403 when user has no profile", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockResolvedValue(null);

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(403);
    });

    it("returns 400 when trying to connect to self", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockResolvedValueOnce({ id: "profile-1", userId: "user-1" });
      prismaMock.profile.findUnique.mockResolvedValueOnce({ id: "profile-1", userId: "user-1" });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-1" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("yourself");
    });

    it("creates a pending connection successfully", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockImplementation((args: { where: { userId?: string; id?: string } }) => {
        if (args.where.userId) return Promise.resolve({ id: "profile-1", userId: "user-1" });
        if (args.where.id) return Promise.resolve({ id: "profile-2", userId: "user-2" });
        return Promise.resolve(null);
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.connection.findFirst.mockResolvedValue(null);
      prismaMock.connection.create.mockResolvedValue({
        id: "conn-1",
        status: "pending",
        createdAt: new Date("2026-06-21T12:00:00Z"),
      });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(201);
      expect(res.body.connection.status).toBe("pending");
      expect(res.body.connection.id).toBe("conn-1");
    });

    it("enforces 24h cooldown on declined connections (R27)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      prismaMock.profile.findUnique.mockImplementation((args: { where: { userId?: string; id?: string } }) => {
        if (args.where.userId) return Promise.resolve({ id: "profile-1", userId: "user-1" });
        if (args.where.id) return Promise.resolve({ id: "profile-2", userId: "user-2" });
        return Promise.resolve(null);
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.connection.findFirst.mockResolvedValue({
        id: "conn-old",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "declined",
        createdAt: oneHourAgo,
      });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("COOLDOWN_ACTIVE");
      expect(res.body.retryAfter).toBeDefined();
    });

    it("allows retry after 24h cooldown expires", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

      prismaMock.profile.findUnique.mockImplementation((args: { where: { userId?: string; id?: string } }) => {
        if (args.where.userId) return Promise.resolve({ id: "profile-1", userId: "user-1" });
        if (args.where.id) return Promise.resolve({ id: "profile-2", userId: "user-2" });
        return Promise.resolve(null);
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.connection.findFirst.mockResolvedValue({
        id: "conn-old",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "declined",
        createdAt: twentyFiveHoursAgo,
      });
      prismaMock.connection.create.mockResolvedValue({
        id: "conn-new",
        status: "pending",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(201);
    });

    it("blocks connections from blocked users", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockImplementation((args: { where: { userId?: string; id?: string } }) => {
        if (args.where.userId) return Promise.resolve({ id: "profile-1", userId: "user-1" });
        if (args.where.id) return Promise.resolve({ id: "profile-2", userId: "user-2" });
        return Promise.resolve(null);
      });
      prismaMock.block.findFirst.mockResolvedValue({
        userId: "user-1",
        blockedUserId: "user-2",
      });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(403);
    });

    it("returns 409 when pending connection already exists", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockImplementation((args: { where: { userId?: string; id?: string } }) => {
        if (args.where.userId) return Promise.resolve({ id: "profile-1", userId: "user-1" });
        if (args.where.id) return Promise.resolve({ id: "profile-2", userId: "user-2" });
        return Promise.resolve(null);
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.connection.findFirst.mockResolvedValue({
        id: "conn-existing",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "pending",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({ receiverId: "profile-2" }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONNECTION_EXISTS");
    });

    it("rejects invalid body (missing receiverId)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-1", userId: "user-1" });

      const req = new Request("http://localhost/api/connections", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(422);
    });
  });

  describe("PATCH /api/connections/[id] — accept/decline", () => {
    it("rejects accept from non-receiver", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-2" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-2" });
      prismaMock.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "profile-1",
        receiverId: "profile-3",
        status: "pending",
      });

      const req = new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      });

      const res = await PATCH(req as never, {
        params: Promise.resolve({ id: "conn-1" }),
      } as never);
      expect(res.status).toBe(403);
    });

    it("accepts a connection as receiver", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-2" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-2" });
      prismaMock.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "pending",
        createdAt: new Date(),
      });
      prismaMock.connection.update.mockResolvedValue({
        id: "conn-1",
        status: "accepted",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      });

      const res = await PATCH(req as never, {
        params: Promise.resolve({ id: "conn-1" }),
      } as never);
      expect(res.status).toBe(200);
      expect(res.body.connection.status).toBe("accepted");
    });

    it("declines a connection as receiver", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-2" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-2" });
      prismaMock.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "pending",
        createdAt: new Date(),
      });
      prismaMock.connection.update.mockResolvedValue({
        id: "conn-1",
        status: "declined",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "decline" }),
      });

      const res = await PATCH(req as never, {
        params: Promise.resolve({ id: "conn-1" }),
      } as never);
      expect(res.status).toBe(200);
      expect(res.body.connection.status).toBe("declined");
    });

    it("rejects actions on already accepted connections", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-2" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-2" });
      prismaMock.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "accepted",
        createdAt: new Date(),
      });

      const req = new Request("http://localhost/api/connections/conn-1", {
        method: "PATCH",
        body: JSON.stringify({ action: "decline" }),
      });

      const res = await PATCH(req as never, {
        params: Promise.resolve({ id: "conn-1" }),
      } as never);
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /api/connections/[id]", () => {
    it("allows either party to delete the connection", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.profile.findUnique.mockResolvedValue({ id: "profile-1" });
      prismaMock.connection.findUnique.mockResolvedValue({
        id: "conn-1",
        requesterId: "profile-1",
        receiverId: "profile-2",
        status: "accepted",
      });
      prismaMock.connection.delete.mockResolvedValue({});

      const req = new Request("http://localhost/api/connections/conn-1", {
        method: "DELETE",
      });

      const res = await DELETE(req as never, {
        params: Promise.resolve({ id: "conn-1" }),
      } as never);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
