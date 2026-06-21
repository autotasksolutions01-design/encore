import { describe, it, expect } from "vitest";
import { signInSchema, onboardingSchema } from "./auth";

describe("signInSchema", () => {
  it("accepts a valid email", () => {
    const result = signInSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("rejects missing email", () => {
    const result = signInSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
    }
  });

  it("rejects invalid email", () => {
    const result = signInSchema.safeParse({ email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signInSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const validInput = {
    displayName: "Juan Guitar",
    instruments: ["guitar", "bass"],
    genres: ["rock", "indie"],
    skillLevel: "intermediate" as const,
    city: "Buenos Aires",
    bio: "Toco desde los 15",
    lookingFor: [{ instrument: "drums", genre: "rock", role: "jam" as const }],
  };

  it("accepts valid onboarding input", () => {
    const result = onboardingSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects when missing instruments", () => {
    const result = onboardingSchema.safeParse({ ...validInput, instruments: [] });
    expect(result.success).toBe(false);
  });

  it("rejects when missing genres", () => {
    const result = onboardingSchema.safeParse({ ...validInput, genres: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing displayName", () => {
    const result = onboardingSchema.safeParse({ ...validInput, displayName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects too long bio", () => {
    const result = onboardingSchema.safeParse({
      ...validInput,
      bio: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid input (no bio, no lookingFor)", () => {
    const { lookingFor, bio, ...minimal } = validInput;
    const result = onboardingSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
