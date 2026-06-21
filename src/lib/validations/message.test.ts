import { describe, it, expect } from "vitest";
import { messageSchema, blockSchema, reportSchema, conversationCreateSchema } from "./message";

describe("messageSchema", () => {
  it("accepts valid message", () => {
    const result = messageSchema.safeParse({
      conversationId: "conv-123",
      text: "Hola!",
    });
    expect(result.success).toBe(true);
  });

  it("defaults isIntroTemplate to false", () => {
    const result = messageSchema.safeParse({
      conversationId: "conv-123",
      text: "Hi",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isIntroTemplate).toBe(false);
    }
  });

  it("rejects empty text", () => {
    const result = messageSchema.safeParse({
      conversationId: "conv-123",
      text: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects text over 1000 chars", () => {
    const result = messageSchema.safeParse({
      conversationId: "conv-123",
      text: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("blockSchema", () => {
  it("accepts valid block", () => {
    const result = blockSchema.safeParse({ userId: "user-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty userId", () => {
    const result = blockSchema.safeParse({ userId: "" });
    expect(result.success).toBe(false);
  });
});

describe("reportSchema", () => {
  it("accepts report with messageId", () => {
    const result = reportSchema.safeParse({
      messageId: "msg-123",
      reason: "Spam",
    });
    expect(result.success).toBe(true);
  });

  it("accepts report with jamId", () => {
    const result = reportSchema.safeParse({
      jamId: "jam-123",
      reason: "Inappropriate content",
    });
    expect(result.success).toBe(true);
  });

  it("rejects report without messageId or jamId", () => {
    const result = reportSchema.safeParse({ reason: "Bad" });
    expect(result.success).toBe(false);
  });
});

describe("conversationCreateSchema", () => {
  it("accepts valid connectionId", () => {
    const result = conversationCreateSchema.safeParse({ connectionId: "conn-123" });
    expect(result.success).toBe(true);
  });
});
