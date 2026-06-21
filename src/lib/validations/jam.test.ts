import { describe, it, expect } from "vitest";
import { jamCreateSchema, jamResponseSchema } from "./jam";

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
    description: "Traigan sus instrumentos",
  };

  it("accepts valid jam", () => {
    const result = jamCreateSchema.safeParse(validJam);
    expect(result.success).toBe(true);
  });

  it("rejects past date", () => {
    const result = jamCreateSchema.safeParse({
      ...validJam,
      dateTime: "2020-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = jamCreateSchema.safeParse({ ...validJam, title: "" });
    expect(result.success).toBe(false);
  });

  it("accepts jam without description", () => {
    const { description, ...withoutDesc } = validJam;
    const result = jamCreateSchema.safeParse(withoutDesc);
    expect(result.success).toBe(true);
  });
});

describe("jamResponseSchema", () => {
  it("accepts 'interested'", () => {
    const result = jamResponseSchema.safeParse({ response: "interested" });
    expect(result.success).toBe(true);
  });

  it("accepts 'going'", () => {
    const result = jamResponseSchema.safeParse({ response: "going" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid response", () => {
    const result = jamResponseSchema.safeParse({ response: "maybe" });
    expect(result.success).toBe(false);
  });
});
