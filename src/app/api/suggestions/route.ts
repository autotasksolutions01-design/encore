import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSuggestions } from "@/lib/suggestions";

/**
 * GET /api/suggestions
 * Returns complementary musician suggestions for the authenticated user's profile.
 * No query params required — engine uses the user's profile data.
 */
export async function GET(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Complete your profile first" },
      { status: 403 },
    );
  }

  try {
    const result = await getSuggestions(profile.id, userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to compute suggestions" },
      { status: 500 },
    );
  }
}
