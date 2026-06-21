import { z } from "zod";

export const clipUploadSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .min(1, { error: "Title is required" })
    .max(200, { error: "Title must be at most 200 characters" }),
  fileSize: z
    .number({ error: "File size is required" })
    .max(5 * 1024 * 1024, { error: "File must be under 5MB" }),
  contentType: z
    .string()
    .refine((val) => val.startsWith("audio/"), {
      message: "File must be an audio file",
    }),
  fileName: z.string().min(1),
});

export const clipCommentSchema = z.object({
  text: z
    .string({ error: "Comment text is required" })
    .min(1, { error: "Comment cannot be empty" })
    .max(500, { error: "Comment must be at most 500 characters" }),
});

export type ClipUploadInput = z.infer<typeof clipUploadSchema>;
export type ClipCommentInput = z.infer<typeof clipCommentSchema>;
