import { z } from "zod";

export const profileSchema = z.object({
  displayName: z
    .string({ error: "Display name is required" })
    .min(1, { error: "Display name is required" })
    .max(100, { error: "Display name must be at most 100 characters" }),
  bio: z
    .string()
    .max(500, { error: "Bio must be at most 500 characters" })
    .nullable()
    .optional(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "pro"], {
    error: "Skill level is required",
  }),
  city: z
    .string({ error: "City is required" })
    .min(1, { error: "City is required" }),
  lat: z.number({ error: "Latitude is required" }).min(-90).max(90),
  lng: z.number({ error: "Longitude is required" }).min(-180).max(180),
  instruments: z
    .array(z.string().min(1))
    .min(1, { error: "At least one instrument is required" }),
  genres: z
    .array(z.string().min(1))
    .min(1, { error: "At least one genre is required" }),
  visibility: z.enum(["public", "connections"]).default("public"),
});

export const profileUpdateSchema = profileSchema.partial();

export const lookingForSchema = z.object({
  instrument: z.string().optional(),
  genre: z.string().optional(),
  role: z.enum(["jam", "band", "session", "collab"], {
    error: "Role is required",
  }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type LookingForInput = z.infer<typeof lookingForSchema>;
