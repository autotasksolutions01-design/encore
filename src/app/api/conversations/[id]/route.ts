import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INTRO_TEMPLATE_ES =
  "Hola, soy {displayName}. Toco {instruments}. Me gusta {genres}. ¡Conectemos!";

/**
 * GET /api/conversations/[id]
 * Returns conversation details including the intro template
 * when the conversation has zero messages.
 *
 * Response 200:
 * {
 *   conversationId: string,
 *   introTemplate: {
 *     templateKey: "musician_intro",
 *     text: string
 *   } | null
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: conversationId } = await params;

  // Find conversation with message count
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      _count: { select: { messages: true } },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  // Verify user is a participant
  if (
    conversation.participantA !== userId &&
    conversation.participantB !== userId
  ) {
    return NextResponse.json(
      { error: "Not a participant in this conversation" },
      { status: 403 },
    );
  }

  // Only return intro template when there are zero messages
  if (conversation._count.messages > 0) {
    return NextResponse.json({
      conversationId,
      introTemplate: null,
    });
  }

  // Resolve intro template from current user's profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      displayName: true,
      instruments: { select: { instrument: true } },
      genres: { select: { genre: true } },
    },
  });

  if (!profile) {
    // No profile yet — still return the conversation but without intro template
    return NextResponse.json({
      conversationId,
      introTemplate: null,
    });
  }

  const instruments = profile.instruments.map((i) => i.instrument).join(", ");
  const genres = profile.genres.map((g) => g.genre).join(", ");

  const resolved = INTRO_TEMPLATE_ES.replace(
    "{displayName}",
    profile.displayName,
  )
    .replace("{instruments}", instruments)
    .replace("{genres}", genres);

  return NextResponse.json({
    conversationId,
    introTemplate: {
      templateKey: "musician_intro" as const,
      text: resolved,
    },
  });
}
