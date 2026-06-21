import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { conversationCreateSchema } from "@/lib/validations/message";

const INTRO_TEMPLATE_ES =
  "Hola, soy {displayName}. Toco {instruments}. Me gusta {genres}. ¡Conectemos!";
const INTRO_TEMPLATE_EN =
  "Hi, I'm {displayName}. I play {instruments}. I like {genres}. Let's connect!";

/**
 * POST /api/conversations
 * Create a conversation from an accepted connection.
 * Returns an introTemplate with profile data resolved (R30).
 *
 * Body: { connectionId: string }
 * Response 201:
 * {
 *   conversationId: string,
 *   introTemplate: {
 *     templateKey: "musician_intro",
 *     text: "Hola, soy Juan. Toco guitarra, bajo. Me gusta rock, indie. ¡Conectemos!"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = conversationCreateSchema.safeParse(body);
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

  const { connectionId } = parsed.data;

  // Find and validate connection
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      requester: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
        },
      },
      receiver: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          instruments: { select: { instrument: true } },
          genres: { select: { genre: true } },
        },
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  if (connection.status !== "accepted") {
    return NextResponse.json(
      { error: "Connection is not accepted" },
      { status: 400 },
    );
  }

  // Verify the user is one of the participants
  const requesterProfile = connection.requester;
  const receiverProfile = connection.receiver;

  if (
    requesterProfile.userId !== userId &&
    receiverProfile.userId !== userId
  ) {
    return NextResponse.json({ error: "Not your connection" }, { status: 403 });
  }

  const participantA = requesterProfile.userId;
  const participantB = receiverProfile.userId;

  // Check for existing conversation
  const existing = await prisma.conversation.findFirst({
    where: {
      OR: [
        { participantA, participantB },
        { participantA: participantB, participantB: participantA },
      ],
    },
  });

  if (existing) {
    // Resolve intro template from sender's profile
    const senderProfile =
      requesterProfile.userId === userId ? requesterProfile : receiverProfile;

    const instruments = senderProfile.instruments
      .map((i) => i.instrument)
      .join(", ");
    const genres = senderProfile.genres.map((g) => g.genre).join(", ");

    const resolved = INTRO_TEMPLATE_ES.replace(
      "{displayName}",
      senderProfile.displayName,
    )
      .replace("{instruments}", instruments)
      .replace("{genres}", genres);

    return NextResponse.json({
      conversationId: existing.id,
      introTemplate: {
        templateKey: "musician_intro" as const,
        text: resolved,
      },
    });
  }

  // Create new conversation
  const conversation = await prisma.conversation.create({
    data: { participantA, participantB },
  });

  // Resolve intro template from sender's profile
  const senderProfile =
    requesterProfile.userId === userId ? requesterProfile : receiverProfile;

  const instruments = senderProfile.instruments
    .map((i) => i.instrument)
    .join(", ");
  const genres = senderProfile.genres.map((g) => g.genre).join(", ");

  const resolved = INTRO_TEMPLATE_ES.replace(
    "{displayName}",
    senderProfile.displayName,
  )
    .replace("{instruments}", instruments)
    .replace("{genres}", genres);

  return NextResponse.json(
    {
      conversationId: conversation.id,
      introTemplate: {
        templateKey: "musician_intro",
        text: resolved,
      },
    },
    { status: 201 },
  );
}

/**
 * GET /api/conversations
 * List all conversations for the authenticated user.
 */
export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ participantA: userId }, { participantB: userId }],
    },
    include: {
      participantAUser: {
        select: { id: true, name: true, avatarUrl: true },
      },
      participantBUser: {
        select: { id: true, name: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { text: true, createdAt: true, senderId: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const mapped = await Promise.all(
    conversations.map(async (conv) => {
      const otherParticipantId =
        conv.participantA === userId ? conv.participantB : conv.participantA;
      const otherUser =
        conv.participantA === userId
          ? conv.participantBUser
          : conv.participantAUser;

      // Get the other participant's profile for displayName
      const otherProfile = await prisma.profile.findUnique({
        where: { userId: otherParticipantId },
        select: { id: true, displayName: true, instruments: { select: { instrument: true } } },
      });

      const lastMessage = conv.messages[0] ?? null;

      return {
        id: conv.id,
        participantA: conv.participantA,
        participantB: conv.participantB,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        otherParticipant: {
          id: otherParticipantId,
          name: otherUser.name,
          avatarUrl: otherUser.avatarUrl,
          displayName: otherProfile?.displayName ?? otherUser.name ?? "Unknown",
          instruments: otherProfile?.instruments.map((i) => i.instrument) ?? [],
        },
        lastMessage: lastMessage
          ? {
              text: lastMessage.text,
              createdAt: lastMessage.createdAt.toISOString(),
              isOwn: lastMessage.senderId === userId,
            }
          : null,
      };
    }),
  );

  return NextResponse.json({ conversations: mapped });
}
