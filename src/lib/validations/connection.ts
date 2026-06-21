import { z } from "zod";

export const connectionSchema = z.object({
  receiverId: z
    .string({ error: "Receiver profile ID is required" })
    .min(1, { error: "Receiver profile ID is required" }),
});

export const connectionResponseSchema = z.object({
  action: z.enum(["accept", "decline"], {
    error: "Action must be accept or decline",
  }),
});

export type ConnectionInput = z.infer<typeof connectionSchema>;
export type ConnectionResponseInput = z.infer<typeof connectionResponseSchema>;
