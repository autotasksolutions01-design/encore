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
  conversation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  block: {
    findFirst: vi.fn(),
  },
  profile: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { GET, POST } = await import("../route");

describe("Messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/messages — polling (R33)", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const req = new Request(
        "http://localhost/api/messages?conversationId=conv-1",
      );

      const res = await GET(req as never);
      expect(res.status).toBe(401);
    });

    it("returns 400 when conversationId missing", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });

      const req = new Request("http://localhost/api/messages");

      const res = await GET(req as never);
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-participant", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-99" } });
      prismaMock.conversation.findFirst.mockResolvedValue(null);

      const req = new Request(
        "http://localhost/api/messages?conversationId=conv-1",
      );

      const res = await GET(req as never);
      expect(res.status).toBe(404);
    });

    it("returns messages and marks them as delivered", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.message.findMany.mockResolvedValue([
        {
          id: "msg-1",
          conversationId: "conv-1",
          senderId: "user-2",
          text: "Hola!",
          isIntroTemplate: false,
          status: "sent",
          createdAt: new Date("2026-06-21T12:00:00Z"),
        },
      ]);
      prismaMock.message.updateMany.mockResolvedValue({ count: 1 });

      const req = new Request(
        "http://localhost/api/messages?conversationId=conv-1",
      );

      const res = await GET(req as never);
      expect(res.status).toBe(200);
      expect(res.body.messages).toHaveLength(1);
      expect(res.body.messages[0].status).toBe("delivered");
      expect(res.body.messages[0].isOwn).toBe(false);
    });

    it("returns 304 when no new messages since timestamp", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.message.findMany.mockResolvedValue([]);

      const req = new Request(
        "http://localhost/api/messages?conversationId=conv-1&since=2026-06-21T12:00:00Z",
      );

      const res = await GET(req as never);
      expect(res.status).toBe(304);
    });

    it("returns 403 when blocked by other participant", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      // Second findFirst for getOtherParticipant
      prismaMock.conversation.findUnique.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue({
        userId: "user-1",
        blockedUserId: "user-2",
      });

      const req = new Request(
        "http://localhost/api/messages?conversationId=conv-1",
      );

      const res = await GET(req as never);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/messages — send message", () => {
    it("returns 401 when unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "Hola",
        }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(401);
    });

    it("sends a message and returns 201", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue({
        id: "msg-new",
        conversationId: "conv-1",
        senderId: "user-1",
        text: "Hola!",
        isIntroTemplate: false,
        status: "sent",
        createdAt: new Date("2026-06-21T12:00:00Z"),
      });
      prismaMock.conversation.update.mockResolvedValue({});
      prismaMock.message.updateMany.mockResolvedValue({ count: 0 });

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "Hola!",
        }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(201);
      expect(res.body.message.text).toBe("Hola!");
      expect(res.body.message.isOwn).toBe(true);
    });

    it("sends intro template message", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue({
        id: "msg-intro",
        conversationId: "conv-1",
        senderId: "user-1",
        text: "Hola, soy Juan. Toco guitarra. Me gusta rock. ¡Conectemos!",
        isIntroTemplate: true,
        status: "sent",
        createdAt: new Date(),
      });
      prismaMock.conversation.update.mockResolvedValue({});
      prismaMock.message.updateMany.mockResolvedValue({ count: 0 });

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "Hola, soy Juan. Toco guitarra. Me gusta rock. ¡Conectemos!",
          isIntroTemplate: true,
        }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(201);
      expect(res.body.message.isIntroTemplate).toBe(true);
    });

    it("blocks messages when blocked (R31)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue({
        userId: "user-2",
        blockedUserId: "user-1",
      });

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "Hola",
        }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Cannot message");
    });

    it("rejects empty text", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "",
        }),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(422);
    });

    it("marks previous messages as read on send (read receipt)", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } });
      prismaMock.conversation.findFirst.mockResolvedValue({
        id: "conv-1",
        participantA: "user-1",
        participantB: "user-2",
      });
      prismaMock.block.findFirst.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue({
        id: "msg-new",
        conversationId: "conv-1",
        senderId: "user-1",
        text: "Hola!",
        isIntroTemplate: false,
        status: "sent",
        createdAt: new Date(),
      });
      prismaMock.conversation.update.mockResolvedValue({});

      const req = new Request("http://localhost/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: "conv-1",
          text: "Hola!",
        }),
      });

      await POST(req as never);
      expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: "conv-1",
          senderId: "user-2",
          status: { in: ["delivered", "sent"] },
        },
        data: { status: "read" },
      });
    });
  });
});
