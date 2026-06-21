import { z } from "zod";

export const messageSchema = z.object({
  conversationId: z
    .string({ error: "Conversation ID is required" })
    .min(1),
  text: z
    .string({ error: "Message text is required" })
    .min(1, { error: "Message cannot be empty" })
    .max(1000, { error: "Message must be at most 1000 characters" }),
  isIntroTemplate: z.boolean().default(false),
});

export const conversationCreateSchema = z.object({
  connectionId: z
    .string({ error: "Connection ID is required" })
    .min(1),
});

export const messagesQuerySchema = z.object({
  conversationId: z.string().min(1),
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const blockSchema = z.object({
  userId: z
    .string({ error: "User ID is required" })
    .min(1),
});

export const reportSchema = z.object({
  messageId: z.string().min(1).optional(),
  jamId: z.string().min(1).optional(),
  reason: z
    .string({ error: "Reason is required" })
    .min(1, { error: "Reason is required" })
    .max(500, { error: "Reason must be at most 500 characters" }),
}).refine(
  (data) => data.messageId || data.jamId,
  { message: "Either messageId or jamId must be provided" },
);

export type MessageInput = z.infer<typeof messageSchema>;
export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type BlockInput = z.infer<typeof blockSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
