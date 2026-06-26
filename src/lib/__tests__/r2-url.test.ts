import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getR2PublicUrl } from "../r2-url";

function envSave() {
  return { ...process.env };
}

function envRestore(saved: Record<string, string | undefined>) {
  process.env = { ...saved };
}

describe("getR2PublicUrl", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = envSave();
    delete process.env.R2_PUBLIC_URL;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_ENDPOINT;
  });

  afterEach(() => {
    envRestore(savedEnv);
  });

  describe("R2_PUBLIC_URL set with trailing slash(es)", () => {
    it("removes a single trailing slash", () => {
      process.env.R2_PUBLIC_URL = "https://cdn.example.com/";
      expect(getR2PublicUrl("avatars/123.png")).toBe(
        "https://cdn.example.com/avatars/123.png",
      );
    });

    it("removes multiple trailing slashes", () => {
      process.env.R2_PUBLIC_URL = "https://cdn.example.com///";
      expect(getR2PublicUrl("avatars/123.png")).toBe(
        "https://cdn.example.com/avatars/123.png",
      );
    });
  });

  describe("R2_PUBLIC_URL set without trailing slash", () => {
    it("joins with a single slash", () => {
      process.env.R2_PUBLIC_URL = "https://cdn.example.com";
      expect(getR2PublicUrl("avatars/123.png")).toBe(
        "https://cdn.example.com/avatars/123.png",
      );
    });
  });

  describe("fallback: R2_BUCKET_NAME + R2_ENDPOINT (no R2_PUBLIC_URL)", () => {
    it("returns https://{bucket}.{host}/{key}", () => {
      process.env.R2_BUCKET_NAME = "my-bucket";
      process.env.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
      expect(getR2PublicUrl("files/doc.pdf")).toBe(
        "https://my-bucket.account.r2.cloudflarestorage.com/files/doc.pdf",
      );
    });

    it("extracts hostname from endpoint with path", () => {
      process.env.R2_BUCKET_NAME = "uploads";
      process.env.R2_ENDPOINT = "https://storage.example.com/path/to/resource";
      expect(getR2PublicUrl("key")).toBe(
        "https://uploads.storage.example.com/key",
      );
    });
  });

  describe("neither R2_PUBLIC_URL nor (R2_BUCKET_NAME and R2_ENDPOINT) set", () => {
    it("returns empty string when no env vars are set", () => {
      expect(getR2PublicUrl("key")).toBe("");
    });

    it("returns empty string when only R2_BUCKET_NAME is set", () => {
      process.env.R2_BUCKET_NAME = "my-bucket";
      expect(getR2PublicUrl("key")).toBe("");
    });

    it("returns empty string when only R2_ENDPOINT is set", () => {
      process.env.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
      expect(getR2PublicUrl("key")).toBe("");
    });
  });
});
