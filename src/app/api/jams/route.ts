import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jamCreateSchema, jamQuerySchema } from "@/lib/validations/jam";

const RESULTS_PER_PAGE = 20;
const MAX_RADIUS_KM = 500;
const MAX_ACTIVE_JAMS = 10;

/**
 * GET /api/jams
 * Returns active jam sessions, optionally filtered by genre and location.
 * Query params:
 *   - genre: string (optional)
 *   - lat: number (optional)
 *   - lng: number (optional)
 *   - radius: number (default 50, max 500)
 *   - page: number (default 1)
 *   - limit: number (default 20, max 50)
 *
 * Sorted by dateTime ascending (soonest first).
 * Uses PostGIS ST_DWithin for spatial filtering.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = jamQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  }

  const { genre, lat, lng, radius, page, limit } = parsed.data;

  const hasSpatial = lat !== undefined && lng !== undefined;
  const clampedRadius = Math.min(radius, MAX_RADIUS_KM);
  const offset = (page - 1) * limit;

  // Build query conditions
  const conditions: string[] = ['js."status" = \'active\'', 'js."dateTime" > NOW()'];
  const queryParams: (string | number)[] = [];
  let paramIdx = 0;

  if (genre) {
    paramIdx++;
    conditions.push(`js."genre" = $${paramIdx}`);
    queryParams.push(genre);
  }

  if (hasSpatial && lng !== undefined && lat !== undefined) {
    paramIdx++;
    const lngParam = paramIdx;
    paramIdx++;
    const latParam = paramIdx;
    paramIdx++;
    const radiusParam = paramIdx;
    conditions.push(
      `ST_DWithin(ST_MakePoint(js."lng", js."lat")::geography, ST_MakePoint($${lngParam}, $${latParam})::geography, $${radiusParam} * 1000)`,
    );
    queryParams.push(lng, lat, clampedRadius);
  }

  const whereClause = conditions.join(" AND ");

  // Count total
  const countSql = `SELECT COUNT(*)::int AS total FROM "JamSession" js WHERE ${whereClause}`;
  const countResult = await prisma.$queryRawUnsafe<{ total: number }[]>(
    countSql,
    ...queryParams,
  );
  const total = countResult[0]?.total ?? 0;

  // Fetch with pagination
  const dataSql = `
    SELECT
      js.id, js.title, js.genre, js."dateTime", js.lat, js.lng,
      js."locationName", js.description, js.status, js."createdAt",
      js."creatorId",
      p."displayName" as "creatorName",
      p."skillLevel" as "creatorSkillLevel",
      (
        SELECT COUNT(*)::int
        FROM "JamResponse" jr
        WHERE jr."jamId" = js.id
      ) as "responseCount"
    FROM "JamSession" js
    JOIN "Profile" p ON p.id = js."creatorId"
    WHERE ${whereClause}
    ORDER BY js."dateTime" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      title: string;
      genre: string;
      dateTime: Date;
      lat: number;
      lng: number;
      locationName: string;
      description: string | null;
      status: string;
      createdAt: Date;
      creatorId: string;
      creatorName: string;
      creatorSkillLevel: string;
      responseCount: number;
    }[]
  >(dataSql, ...queryParams);

  // Batch-load instruments for creators
  const creatorIds = [...new Set(rows.map((r) => r.creatorId))];
  const instrumentsMap = new Map<string, string[]>();
  if (creatorIds.length > 0) {
    const instruments = await prisma.profileInstrument.findMany({
      where: { profileId: { in: creatorIds } },
      select: { profileId: true, instrument: true },
    });
    for (const inst of instruments) {
      const arr = instrumentsMap.get(inst.profileId) ?? [];
      arr.push(inst.instrument);
      instrumentsMap.set(inst.profileId, arr);
    }
  }

  const jams = rows.map((row) => ({
    id: row.id,
    title: row.title,
    genre: row.genre,
    dateTime: row.dateTime.toISOString(),
    lat: row.lat,
    lng: row.lng,
    locationName: row.locationName,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    responseCount: row.responseCount,
    creator: {
      id: row.creatorId,
      displayName: row.creatorName,
      skillLevel: row.creatorSkillLevel,
      instruments: instrumentsMap.get(row.creatorId) ?? [],
    },
  }));

  return NextResponse.json({
    jams,
    total,
    page,
    pageSize: limit,
    hasMore: offset + limit < total,
  });
}

/**
 * POST /api/jams
 * Creates a new jam session. Authenticated users only.
 * Body must conform to jamCreateSchema.
 *
 * Rules (R34):
 * - Max 10 active jams per user
 * - dateTime must be in the future
 * - All required fields must be present
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get creator profile
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

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jamCreateSchema.safeParse(body);
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

  const { title, genre, dateTime, lat, lng, locationName, description } =
    parsed.data;

  // Check 10-active limit (R34)
  const activeCount = await prisma.jamSession.count({
    where: {
      creatorId: profile.id,
      status: "active",
      dateTime: { gt: new Date() },
    },
  });

  if (activeCount >= MAX_ACTIVE_JAMS) {
    return NextResponse.json(
      {
        error: `Max ${MAX_ACTIVE_JAMS} active jams per user`,
        code: "JAM_LIMIT",
      },
      { status: 429 },
    );
  }

  const jam = await prisma.jamSession.create({
    data: {
      creatorId: profile.id,
      title,
      genre,
      dateTime: new Date(dateTime),
      lat,
      lng,
      locationName,
      description: description ?? null,
      status: "active",
    },
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          skillLevel: true,
          instruments: { select: { instrument: true } },
        },
      },
    },
  });

  return NextResponse.json(
    {
      jam: {
        id: jam.id,
        title: jam.title,
        genre: jam.genre,
        dateTime: jam.dateTime.toISOString(),
        lat: jam.lat,
        lng: jam.lng,
        locationName: jam.locationName,
        description: jam.description,
        status: jam.status,
        createdAt: jam.createdAt.toISOString(),
        responseCount: 0,
        creator: {
          id: jam.creator.id,
          displayName: jam.creator.displayName,
          skillLevel: jam.creator.skillLevel,
          instruments: jam.creator.instruments.map((i) => i.instrument),
        },
      },
    },
    { status: 201 },
  );
}
