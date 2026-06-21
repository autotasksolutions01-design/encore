import { z } from "zod";

export const jamCreateSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .min(1, { error: "Title is required" })
    .max(200, { error: "Title must be at most 200 characters" }),
  genre: z
    .string({ error: "Genre is required" })
    .min(1, { error: "Genre is required" }),
  dateTime: z.coerce.date().refine((d) => d > new Date(), {
    message: "Date must be in the future",
  }),
  lat: z.number({ error: "Latitude is required" }).min(-90).max(90),
  lng: z.number({ error: "Longitude is required" }).min(-180).max(180),
  locationName: z
    .string({ error: "Location name is required" })
    .min(1, { error: "Location name is required" }),
  description: z
    .string()
    .max(1000, { error: "Description must be at most 1000 characters" })
    .optional(),
});

export const jamResponseSchema = z.object({
  response: z.enum(["interested", "going"], {
    error: "Response must be interested or going",
  }),
});

export const jamQuerySchema = z.object({
  genre: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().min(1).max(500).default(50),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type JamCreateInput = z.infer<typeof jamCreateSchema>;
export type JamResponseInput = z.infer<typeof jamResponseSchema>;
