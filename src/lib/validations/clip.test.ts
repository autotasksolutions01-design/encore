import { describe, it, expect } from "vitest";
import { clipUploadSchema, clipCommentSchema } from "./clip";

describe("clipUploadSchema", () => {
  it("accepts valid clip upload", () => {
    const result = clipUploadSchema.safeParse({
      title: "Mi solo",
      fileSize: 3 * 1024 * 1024,
      contentType: "audio/mp3",
      fileName: "solo.mp3",
    });
    expect(result.success).toBe(true);
  });

  it("rejects file over 5MB", () => {
    const result = clipUploadSchema.safeParse({
      title: "Big file",
      fileSize: 6 * 1024 * 1024,
      contentType: "audio/mp3",
      fileName: "big.mp3",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-audio content type", () => {
    const result = clipUploadSchema.safeParse({
      title: "Not audio",
      fileSize: 1024,
      contentType: "image/png",
      fileName: "photo.png",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = clipUploadSchema.safeParse({
      title: "",
      fileSize: 1024,
      contentType: "audio/mp3",
      fileName: "track.mp3",
    });
    expect(result.success).toBe(false);
  });
});

describe("clipCommentSchema", () => {
  it("accepts valid comment", () => {
    const result = clipCommentSchema.safeParse({ text: "Buen solo!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty comment", () => {
    const result = clipCommentSchema.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects too long comment", () => {
    const result = clipCommentSchema.safeParse({ text: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});
