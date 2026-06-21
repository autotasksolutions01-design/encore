import { describe, it, expect } from "vitest";
import { jamCreateSchema, jamResponseSchema, jamQuerySchema } from "@/lib/validations/jam";

/**
 * Integration tests for Jam API validation logic.
 *
 * These tests verify the Zod schemas that gate all jam API endpoints.
 * Full route handler tests (with auth + DB) live in E2E.
 */

describe("Jam API — Request Validation", () => {
  describe("jamCreateSchema", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const validJam = {
      title: "Jazz jam en Palermo",
      genre: "jazz",
      dateTime: futureDate.toISOString(),
      lat: -34.588,
      lng: -58.431,
      locationName: "Thelonious Club",
    };

    it("accepts a valid jam creation payload", () => {
      const result = jamCreateSchema.safeParse(validJam);
      expect(result.success).toBe(true);
    });

    it("rejects past dateTime", () => {
      const result = jamCreateSchema.safeParse({
        ...validJam,
        dateTime: "2020-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty title", () => {
      const result = jamCreateSchema.safeParse({ ...validJam, title: "" });
      expect(result.success).toBe(false);
    });

    it("rejects title over 200 chars", () => {
      const result = jamCreateSchema.safeParse({
        ...validJam,
        title: "x".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid lat/lng ranges", () => {
      const badLat = jamCreateSchema.safeParse({ ...validJam, lat: 200 });
      expect(badLat.success).toBe(false);

      const badLng = jamCreateSchema.safeParse({ ...validJam, lng: 200 });
      expect(badLng.success).toBe(false);
    });

    it("accepts jam with optional description", () => {
      const result = jamCreateSchema.safeParse({
        ...validJam,
        description: "Traigan sus instrumentos",
      });
      expect(result.success).toBe(true);
    });

    it("accepts jam without description", () => {
      const result = jamCreateSchema.safeParse(validJam);
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = jamCreateSchema.safeParse({ title: "Only title" });
      expect(result.success).toBe(false);
    });
  });

  describe("jamResponseSchema", () => {
    it("accepts 'interested'", () => {
      expect(jamResponseSchema.safeParse({ response: "interested" }).success).toBe(true);
    });

    it("accepts 'going'", () => {
      expect(jamResponseSchema.safeParse({ response: "going" }).success).toBe(true);
    });

    it("rejects 'maybe'", () => {
      expect(jamResponseSchema.safeParse({ response: "maybe" }).success).toBe(false);
    });

    it("rejects 'decline'", () => {
      expect(jamResponseSchema.safeParse({ response: "decline" }).success).toBe(false);
    });

    it("rejects empty/missing response", () => {
      expect(jamResponseSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("jamQuerySchema", () => {
    it("applies defaults for empty query", () => {
      const result = jamQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.radius).toBe(50);
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("caps radius at 500km", () => {
      const result = jamQuerySchema.safeParse({ radius: "1000" });
      expect(result.success).toBe(false);
    });

    it("accepts valid filter combination", () => {
      const result = jamQuerySchema.safeParse({
        genre: "rock",
        lat: "-34.588",
        lng: "-58.431",
        radius: "25",
        page: "1",
        limit: "10",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.genre).toBe("rock");
        expect(result.data.lat).toBe(-34.588);
        expect(result.data.radius).toBe(25);
        expect(result.data.limit).toBe(10);
      }
    });
  });
});
