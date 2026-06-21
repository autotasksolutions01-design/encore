import { z } from "zod";

export const emailSchema = z
  .string({ error: "Email is required" })
  .min(1, { error: "Email is required" })
  .email({ error: "Invalid email format" })
  .max(255, { error: "Email must be at most 255 characters" });

export const passwordSchema = z.object({
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" })
    .refine((val) => /[A-Z]/.test(val), {
      message: "Password must contain at least one uppercase letter",
    })
    .refine((val) => /[0-9]/.test(val), {
      message: "Password must contain at least one number",
    }),
});

export const signInSchema = z.object({
  email: emailSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;

export const onboardingSchema = z.object({
  displayName: z
    .string({ error: "Display name is required" })
    .min(1, { error: "Display name is required" })
    .max(100, { error: "Display name must be at most 100 characters" }),
  instruments: z
    .array(z.string().min(1))
    .min(1, { error: "At least one instrument is required" }),
  genres: z
    .array(z.string().min(1))
    .min(1, { error: "At least one genre is required" }),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "pro"], {
    error: "Skill level is required",
  }),
  city: z
    .string({ error: "City is required" })
    .min(1, { error: "City is required" }),
  bio: z
    .string()
    .max(500, { error: "Bio must be at most 500 characters" })
    .optional(),
  lookingFor: z
    .array(
      z.object({
        instrument: z.string().optional(),
        genre: z.string().optional(),
        role: z.enum(["jam", "band", "session", "collab"]),
      }),
    )
    .optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
