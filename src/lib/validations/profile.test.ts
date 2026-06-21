import { describe, it, expect } from "vitest";
import { profileSchema, profileUpdateSchema, lookingForSchema } from "./profile";

describe("profileSchema", () => {
  const validProfile = {
    displayName: "Juan Guitar",
    bio: "Músico de sesión",
    skillLevel: "advanced" as const,
    city: "Buenos Aires",
    lat: -34.6037,
    lng: -58.3816,
    instruments: ["guitar", "bass"],
    genres: ["rock", "blues"],
    visibility: "public" as const,
  };

  it("accepts a valid profile", () => {
    const result = profileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("rejects when instruments is empty", () => {
    const result = profileSchema.safeParse({ ...validProfile, instruments: [] });
    expect(result.success).toBe(false);
  });

  it("rejects when genres is empty", () => {
    const result = profileSchema.safeParse({ ...validProfile, genres: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid skillLevel", () => {
    const result = profileSchema.safeParse({
      ...validProfile,
      skillLevel: "master",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid lat/lng", () => {
    const result = profileSchema.safeParse({ ...validProfile, lat: 200 });
    expect(result.success).toBe(false);
  });

  it("defaults visibility to public", () => {
    const { visibility, ...withoutVis } = validProfile;
    const result = profileSchema.safeParse(withoutVis);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe("public");
    }
  });
});

describe("profileUpdateSchema", () => {
  it("accepts partial input", () => {
    const result = profileUpdateSchema.safeParse({ displayName: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = profileUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("lookingForSchema", () => {
  it("accepts valid lookingFor entry", () => {
    const result = lookingForSchema.safeParse({
      instrument: "drums",
      genre: "rock",
      role: "jam",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without optional instrument", () => {
    const result = lookingForSchema.safeParse({
      genre: "rock",
      role: "band",
    });
    expect(result.success).toBe(true);
  });
});
