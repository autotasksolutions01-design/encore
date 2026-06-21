import { prisma } from "@/lib/prisma";

const RESULTS_PER_PAGE = 20;
const MAX_RADIUS_KM = 500;

interface DiscoveryFilters {
  instrument?: string;
  genre?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  skillLevel?: string;
  page?: number;
}

interface DiscoveryProfile {
  id: string;
  displayName: string;
  bio: string;
  skillLevel: string;
  city: string;
  lat: number;
  lng: number;
  avatarKey: string | null;
  avatarUrl: string | null;
  name: string | null;
  publishedAt: Date | null;
  instruments: string[];
  genres: string[];
}

interface DiscoveryResult {
  profiles: DiscoveryProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Discovery query for public profiles filtered by instrument, genre, location, and skill.
 * Uses PostGIS ST_DWithin for accurate radius searches.
 * All values are parameterized via Prisma.sql to prevent SQL injection.
 */
export async function discoverProfiles(
  filters: DiscoveryFilters,
): Promise<DiscoveryResult> {
  const page = Math.max(1, filters.page ?? 1);
  const radius = Math.min(filters.radiusKm ?? 50, MAX_RADIUS_KM);
  const offset = (page - 1) * RESULTS_PER_PAGE;

  const hasInstrument = !!filters.instrument;
  const hasGenre = !!filters.genre;
  const hasSpatial =
    filters.lat !== undefined && filters.lng !== undefined;
  const hasSkill = !!filters.skillLevel;

  // Count query — uses the same filters but only counts distinct profiles
  const countQuery = buildCountQuery({
    hasInstrument,
    hasGenre,
    hasSpatial,
    hasSkill,
    radius,
    lat: filters.lat,
    lng: filters.lng,
  });

  const countParams = buildCountParams(filters, radius);
  const countResult = await prisma.$queryRawUnsafe<{ total: number }[]>(
    countQuery,
    ...countParams,
  );
  const total = countResult[0]?.total ?? 0;

  if (total === 0) {
    return {
      profiles: [],
      total: 0,
      page,
      pageSize: RESULTS_PER_PAGE,
      hasMore: false,
    };
  }

  // Data query with ORDER BY and LIMIT/OFFSET
  const dataQuery = buildDataQuery({
    hasInstrument,
    hasGenre,
    hasSpatial,
    hasSkill,
    radius,
    lat: filters.lat,
    lng: filters.lng,
    offset,
  });

  const dataParams = buildDataParams(filters, radius, offset);
  const rows = await prisma.$queryRawUnsafe<{
    id: string;
    displayName: string;
    bio: string;
    skillLevel: string;
    city: string;
    lat: number;
    lng: number;
    avatarKey: string | null;
    avatarUrl: string | null;
    name: string | null;
    publishedAt: Date | null;
  }[]>(dataQuery, ...dataParams);

  // Batch-load instruments and genres for all returned profiles
  const profileIds = rows.map((r) => r.id);
  const instrumentsMap = new Map<string, string[]>();
  const genresMap = new Map<string, string[]>();

  if (profileIds.length > 0) {
    const instruments = await prisma.profileInstrument.findMany({
      where: { profileId: { in: profileIds } },
      select: { profileId: true, instrument: true },
    });
    for (const inst of instruments) {
      const arr = instrumentsMap.get(inst.profileId) ?? [];
      arr.push(inst.instrument);
      instrumentsMap.set(inst.profileId, arr);
    }

    const genres = await prisma.profileGenre.findMany({
      where: { profileId: { in: profileIds } },
      select: { profileId: true, genre: true },
    });
    for (const g of genres) {
      const arr = genresMap.get(g.profileId) ?? [];
      arr.push(g.genre);
      genresMap.set(g.profileId, arr);
    }
  }

  const profiles = rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    skillLevel: row.skillLevel,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    avatarKey: row.avatarKey,
    avatarUrl: row.avatarUrl,
    name: row.name,
    instruments: instrumentsMap.get(row.id) ?? [],
    genres: genresMap.get(row.id) ?? [],
    publishedAt: row.publishedAt,
  }));

  return {
    profiles,
    total,
    page,
    pageSize: RESULTS_PER_PAGE,
    hasMore: offset + RESULTS_PER_PAGE < total,
  };
}

interface QueryBuildOptions {
  hasInstrument: boolean;
  hasGenre: boolean;
  hasSpatial: boolean;
  hasSkill: boolean;
  radius: number;
  lat?: number;
  lng?: number;
  offset?: number;
}

function buildWhereClause(opts: QueryBuildOptions): string {
  const parts: string[] = [
    'p."visibility" = \'public\'',
    'p."publishedAt" IS NOT NULL',
  ];

  if (opts.hasInstrument) {
    parts.push('pi."instrument" = $1');
  }
  if (opts.hasGenre) {
    const idx = opts.hasInstrument ? 2 : 1;
    parts.push(`pg."genre" = $${idx}`);
  }
  if (opts.hasSkill) {
    let idx = 1;
    if (opts.hasInstrument) idx++;
    if (opts.hasGenre) idx++;
    parts.push(`p."skillLevel"::text = $${idx}`);
  }
  if (opts.hasSpatial) {
    let idx = 1;
    if (opts.hasInstrument) idx++;
    if (opts.hasGenre) idx++;
    if (opts.hasSkill) idx++;
    parts.push(
      `ST_DWithin(ST_MakePoint(p."lng", p."lat")::geography, ST_MakePoint($${idx}, $${idx + 1})::geography, $${idx + 2} * 1000)`,
    );
  }

  return parts.join(" AND ");
}

function buildJoins(opts: QueryBuildOptions): string {
  const joins: string[] = [];
  if (opts.hasInstrument) joins.push('JOIN "ProfileInstrument" pi ON pi."profileId" = p.id');
  if (opts.hasGenre) joins.push('JOIN "ProfileGenre" pg ON pg."profileId" = p.id');
  return joins.join(" ");
}

function buildOrderBy(opts: QueryBuildOptions): string {
  if (opts.hasSpatial) {
    let idx = 1;
    if (opts.hasInstrument) idx++;
    if (opts.hasGenre) idx++;
    if (opts.hasSkill) idx++;
    return `ORDER BY ST_Distance(ST_MakePoint(p."lng", p."lat")::geography, ST_MakePoint($${idx}, $${idx + 1})::geography) ASC`;
  }
  return 'ORDER BY p."publishedAt" DESC';
}

function buildCountQuery(opts: QueryBuildOptions): string {
  const where = buildWhereClause(opts);
  const joins = buildJoins(opts);
  return `SELECT COUNT(DISTINCT p.id)::int AS total FROM "Profile" p ${joins} WHERE ${where}`;
}

function buildDataQuery(opts: QueryBuildOptions): string {
  const where = buildWhereClause(opts);
  const joins = buildJoins(opts);
  const order = buildOrderBy(opts);

  return `
    SELECT DISTINCT
      p.id, p."displayName", p.bio, p."skillLevel", p.city,
      p.lat, p.lng, p."avatarKey", p."publishedAt",
      u."avatarUrl", u.name
    FROM "Profile" p
    JOIN "User" u ON u.id = p."userId"
    ${joins}
    WHERE ${where}
    ${order}
    LIMIT ${RESULTS_PER_PAGE} OFFSET ${opts.offset ?? 0}
  `;
}

function buildCountParams(
  filters: DiscoveryFilters,
  radius: number,
): (string | number)[] {
  const params: (string | number)[] = [];
  if (filters.instrument) params.push(filters.instrument);
  if (filters.genre) params.push(filters.genre);
  if (filters.skillLevel) params.push(filters.skillLevel);
  if (
    filters.lat !== undefined &&
    filters.lng !== undefined
  ) {
    params.push(filters.lng, filters.lat, radius);
  }
  return params;
}

function buildDataParams(
  filters: DiscoveryFilters,
  radius: number,
  offset: number,
): (string | number)[] {
  const params = buildCountParams(filters, radius);
  // ORDER BY spatial uses same params (no extra params needed since we reference $N)
  // LIMIT/OFFSET are embedded directly (safe: integers)
  return params;
}
