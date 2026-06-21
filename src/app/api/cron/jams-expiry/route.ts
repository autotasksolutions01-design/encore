import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/jams-expiry
 * Vercel Cron handler — runs hourly to mark expired jam sessions.
 *
 * A jam is expired when:
 * - Its dateTime is more than 24 hours in the past AND
 * - Its status is still "active"
 *
 * R35: Jam posts MUST auto-expire and hide from feed 24h after the session date.
 *
 * Security: Cron job is invoked by Vercel with a shared secret.
 * We validate the Authorization bearer token matches CRON_SECRET.
 */
export async function POST(request: Request) {
  // Validate cron secret for security
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  );

  // Find active jams whose dateTime is more than 24h in the past
  const expiredJams = await prisma.jamSession.findMany({
    where: {
      status: "active",
      dateTime: { lt: twentyFourHoursAgo },
    },
    select: { id: true },
  });

  if (expiredJams.length === 0) {
    return NextResponse.json({
      message: "No jams to expire",
      expired: 0,
      checkedAt: new Date().toISOString(),
    });
  }

  // Batch update all expired jams
  const result = await prisma.jamSession.updateMany({
    where: {
      id: { in: expiredJams.map((j) => j.id) },
    },
    data: { status: "expired" },
  });

  return NextResponse.json({
    message: `Expired ${result.count} jam sessions`,
    expired: result.count,
    expiredIds: expiredJams.map((j) => j.id),
    checkedAt: new Date().toISOString(),
  });
}

/**
 * GET — for Vercel Cron health check only.
 * Returns 200 with basic status. Does not perform expiry.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", description: "Jam expiry cron endpoint" });
}
