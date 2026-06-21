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
  message: {
    findUnique: vi.fn(),
  },
  jamSession: {
    findUnique: vi.fn(),
  },
  report: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { POST } = await import("../route");

describe("Report API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ messageId: "msg-1", reason: "Spam" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("creates a message report", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-1" });
    prismaMock.report.create.mockResolvedValue({
      id: "report-1",
      reporterId: "user-1",
      messageId: "msg-1",
      jamId: null,
      reason: "Spam",
      status: "pending",
      createdAt: new Date("2026-06-21T12:00:00Z"),
    });

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ messageId: "msg-1", reason: "Spam" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(res.body.report.reason).toBe("Spam");
    expect(res.body.report.status).toBe("pending");
  });

  it("creates a jam report", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.jamSession.findUnique.mockResolvedValue({ id: "jam-1" });
    prismaMock.report.create.mockResolvedValue({
      id: "report-2",
      reporterId: "user-1",
      messageId: null,
      jamId: "jam-1",
      reason: "Inappropriate content",
      status: "pending",
      createdAt: new Date(),
    });

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ jamId: "jam-1", reason: "Inappropriate content" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(201);
    expect(res.body.report.jamId).toBe("jam-1");
  });

  it("returns 422 when neither messageId nor jamId provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ reason: "Bad" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 404 when reported message not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.message.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({ messageId: "msg-nonexistent", reason: "Spam" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(404);
  });

  it("rejects reason over 500 chars", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-1" });

    const req = new Request("http://localhost/api/reports", {
      method: "POST",
      body: JSON.stringify({
        messageId: "msg-1",
        reason: "x".repeat(501),
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });
});
