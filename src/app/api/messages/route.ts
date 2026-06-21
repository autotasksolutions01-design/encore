import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema, messagesQuerySchema } from "@/lib/validations/message";

/**
 * GET /api/messages
 * Poll for new messages in a conversation (R33).
 * Query: ?conversationId=X&since=ISO_8601
 *
 * Returns messages newer than `since`, or 304 Not Modified if no new messages.
 * Returns 404 if conversation not found or user is not a participant.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(request.url);

  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json(
      { error: "conversationId is required" },
      { status: 400 },
    );
  }

  // Verify user is a participant
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ participantA: userId }, { participantB: userId }],
    },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // Check if blocked
  const otherParticipantId = await getOtherParticipant(conversationId, userId);
  if (otherParticipantId) {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { userId, blockedUserId: otherParticipantId },
          { userId: otherParticipantId, blockedUserId: userId },
        ],
      },
    });
    if (block) {
      return NextResponse.json(
        { error: "Cannot access this conversation" },
        { status: 403 },
      );
    }
  }

  const sinceParam = url.searchParams.get("since");

  const since = sinceParam ? new Date(sinceParam) : new Date(0);
  if (sinceParam && isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "Invalid since parameter. Use ISO 8601 format." },
      { status: 400 },
    );
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      text: true,
      isIntroTemplate: true,
      status: true,
      createdAt: true,
    },
  });

  // Mark messages from the other user as "delivered"
  const otherMessages = messages.filter((m) => m.senderId !== userId && m.status === "sent");
  if (otherMessages.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: otherMessages.map((m) => m.id) } },
      data: { status: "delivered" },
    });
    // Update the in-memory status for the response
    for (const m of messages) {
      if (m.senderId !== userId && m.status === "sent") {
        m.status = "delivered";
      }
    }
  }

  // 304 Not Modified
  if (messages.length === 0 && sinceParam) {
    return new NextResponse(null, { status: 304 });
  }

  const mapped = messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    text: m.text,
    isIntroTemplate: m.isIntroTemplate,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    isOwn: m.senderId === userId,
  }));

  return NextResponse.json({ messages: mapped });
}

/**
 * POST /api/messages
 * Send a message in a conversation. Auto-marks read receipts for previous
 * messages from the other participant (R29).
 *
 * Body: { conversationId: string, text: string, isIntroTemplate?: boolean }
 *
 * Guards:
 * - User must be a participant
 * - Blocked users cannot send (R31)
 * - DM rate limit handled by middleware
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const { conversationId, text, isIntroTemplate } = parsed.data;

  // Verify user is a participant
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ participantA: userId }, { participantB: userId }],
    },
    select: { id: true, participantA: true, participantB: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // Check if blocked (R31)
  const otherParticipantId =
    conversation.participantA === userId
      ? conversation.participantB
      : conversation.participantA;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { userId, blockedUserId: otherParticipantId },
        { userId: otherParticipantId, blockedUserId: userId },
      ],
    },
  });

  if (block) {
    return NextResponse.json(
      { error: "Cannot message this user" },
      { status: 403 },
    );
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      text,
      isIntroTemplate,
    },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      text: true,
      isIntroTemplate: true,
      status: true,
      createdAt: true,
    },
  });

  // Update conversation lastMessageAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  // Mark previous unread messages from the other participant as "read" (read receipt)
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: otherParticipantId,
      status: { in: ["delivered", "sent"] },
    },
    data: { status: "read" },
  });

  return NextResponse.json(
    {
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        text: message.text,
        isIntroTemplate: message.isIntroTemplate,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
        isOwn: true,
      },
    },
    { status: 201 },
  );
}

/**
 * Helper: get the other participant's userId in a conversation.
 */
async function getOtherParticipant(
  conversationId: string,
  userId: string,
): Promise<string | null> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participantA: true, participantB: true },
  });
  if (!conv) return null;
  return conv.participantA === userId ? conv.participantB : conv.participantA;
}
