import { prisma } from "@/lib/prisma";

const MAX_SUGGESTIONS = 20;
const MAX_RADIUS_KM = 50;

/**
 * Complementary instrument mapping: which instruments pair well together.
 * guitar ↔ bass, drums | keys ↔ bass, drums | voice ↔ guitar, keys
 */
const COMPLEMENTARY: Record<string, string[]> = {
  guitar: ["bass", "drums", "voice"],
  bass: ["guitar", "drums", "keyboard", "piano"],
  drums: ["guitar", "bass", "keyboard", "piano"],
  piano: ["bass", "drums", "voice", "guitar"],
  keyboard: ["bass", "drums", "voice", "guitar"],
  voice: ["guitar", "piano", "keyboard"],
  violin: ["cello", "piano", "guitar"],
  cello: ["violin", "piano"],
  trumpet: ["saxophone", "trombone", "drums", "piano"],
  saxophone: ["trumpet", "trombone", "drums", "bass"],
  trombone: ["trumpet", "saxophone", "drums"],
  flute: ["piano", "guitar", "strings"],
  clarinet: ["piano", "guitar"],
  ukulele: ["guitar", "voice"],
  harmonica: ["guitar", "bass"],
  accordion: ["guitar", "bass"],
  synth: ["drums", "bass", "guitar"],
  percussion: ["guitar", "bass", "keyboard", "piano"],
};

interface SuggestionProfile {
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
  instruments: string[];
  genres: string[];
  matchedOn: {
    instruments: string[];
    genres: string[];
    distanceKm: number;
  };
  score: number;
}

interface SuggestionResult {
  suggestions: SuggestionProfile[];
  total: number;
}

/**
 * Compute suggestions for a given profile based on:
 * 1. Complementary instrument matching (static lookup table)
 * 2. Genre overlap (set intersection)
 * 3. Location proximity (PostGIS ST_DWithin, ≤50km)
 *
 * Results are sorted by a composite score:
 *   score = (complementary_matches * 3) + (genre_overlaps * 2) + distance_bonus
 * where distance_bonus is max(0, 50 - distanceKm).
 */
export async function getSuggestions(
  profileId: string,
  userId: string,
): Promise<SuggestionResult> {
  // Load the target profile with instruments, genres, and location
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      lat: true,
      lng: true,
      instruments: { select: { instrument: true } },
      genres: { select: { genre: true } },
    },
  });

  if (!profile) {
    return { suggestions: [], total: 0 };
  }

  // Build complementary instrument list
  const myInstruments = profile.instruments.map((i) => i.instrument);
  const complementarySet = new Set<string>();
  for (const inst of myInstruments) {
    const comps = COMPLEMENTARY[inst];
    if (comps) {
      for (const c of comps) complementarySet.add(c);
    }
  }
  // Remove own instruments from complementary list
  for (const inst of myInstruments) {
    complementarySet.delete(inst);
  }

  if (complementarySet.size === 0) {
    return { suggestions: [], total: 0 };
  }

  const complementaryList = Array.from(complementarySet);

  // Spatial query: find profiles within MAX_RADIUS_KM that play complementary instruments
  // Exclude: self, already connected, already pending, already declined <24h, blocked
  const myGenres = profile.genres.map((g) => g.genre);

  // Get already connected/blocked user IDs to exclude
  const existingConnectionUserIds = new Set<string>();

  // Connections where I'm requester or receiver
  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ requesterId: profileId }, { receiverId: profileId }],
    },
    select: { requesterId: true, receiverId: true },
  });

  for (const conn of connections) {
    existingConnectionUserIds.add(conn.requesterId);
    existingConnectionUserIds.add(conn.receiverId);
  }

  // Blocks (both directions)
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ userId }, { blockedUserId: userId }],
    },
    select: { userId: true, blockedUserId: true },
  });

  for (const block of blocks) {
    // Don't suggest people who blocked me or who I blocked
    if (block.userId === userId) {
      existingConnectionUserIds.add(block.blockedUserId);
    } else {
      existingConnectionUserIds.add(block.userId);
    }
  }

  // Build complementary instrument condition as an OR of multiple params
  // We pass them as positional parameters to $queryRawUnsafe
  const compParams = complementaryList.map((_, i) => `$${i + 4}`);
  const compCondition = complementaryList.length === 1
    ? `pi."instrument" = $4`
    : `pi."instrument" IN (${compParams.join(", ")})`;

  // Spatial params
  const spatialOffset = 4 + complementaryList.length;
  const spatialParams = `$${spatialOffset}, $${spatialOffset + 1}, $${spatialOffset + 2}`;

  // Build exclusion list
  const excludedProfileIds = [...existingConnectionUserIds, profile.id];
  const excludePlaceholders = excludedProfileIds.map((_, i) => `$${spatialOffset + 3 + i}`);
  const excludeCondition = excludedProfileIds.length > 0
    ? `AND p.id NOT IN (${excludePlaceholders.join(", ")})`
    : "";

  const query = `
    SELECT DISTINCT
      p.id, p."displayName", p.bio, p."skillLevel", p.city,
      p.lat, p.lng, p."avatarKey", p."publishedAt",
      u."avatarUrl", u.name,
      ST_Distance(
        ST_MakePoint(p."lng", p."lat")::geography,
        ST_MakePoint(${spatialParams})::geography
      ) AS distance_m
    FROM "Profile" p
    JOIN "User" u ON u.id = p."userId"
    JOIN "ProfileInstrument" pi ON pi."profileId" = p.id
    WHERE p."visibility" = 'public'
      AND p."publishedAt" IS NOT NULL
      AND ${compCondition}
      AND ST_DWithin(
        ST_MakePoint(p."lng", p."lat")::geography,
        ST_MakePoint(${spatialParams})::geography,
        $${spatialOffset + 2} * 1000
      )
      ${excludeCondition}
    ORDER BY distance_m ASC
    LIMIT ${MAX_SUGGESTIONS * 3}
  `;

  const allParams: (string | number)[] = [
    ...complementaryList,
    profile.lng,
    profile.lat,
    MAX_RADIUS_KM,
    ...excludedProfileIds,
  ];

  const rows = await prisma.$queryRawUnsafe<
    {
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
      distance_m: number;
    }[]
  >(query, ...allParams);

  if (rows.length === 0) {
    return { suggestions: [], total: 0 };
  }

  // Batch-load instruments and genres for candidate profiles
  const candidateIds = rows.map((r) => r.id);
  const instrumentsMap = new Map<string, string[]>();
  const genresMap = new Map<string, string[]>();

  if (candidateIds.length > 0) {
    const instruments = await prisma.profileInstrument.findMany({
      where: { profileId: { in: candidateIds } },
      select: { profileId: true, instrument: true },
    });
    for (const inst of instruments) {
      const arr = instrumentsMap.get(inst.profileId) ?? [];
      arr.push(inst.instrument);
      instrumentsMap.set(inst.profileId, arr);
    }

    const genres = await prisma.profileGenre.findMany({
      where: { profileId: { in: candidateIds } },
      select: { profileId: true, genre: true },
    });
    for (const g of genres) {
      const arr = genresMap.get(g.profileId) ?? [];
      arr.push(g.genre);
      genresMap.set(g.profileId, arr);
    }
  }

  // Score and rank candidates
  const scored = rows.map((row) => {
    const candidateInstruments = instrumentsMap.get(row.id) ?? [];
    const candidateGenres = genresMap.get(row.id) ?? [];

    const matchedInstruments = candidateInstruments.filter((inst) =>
      complementaryList.includes(inst),
    );

    const matchedGenres = candidateGenres.filter((g) =>
      myGenres.includes(g),
    );

    const distanceKm = row.distance_m / 1000;
    const distanceBonus = Math.max(0, MAX_RADIUS_KM - distanceKm);

    const score =
      matchedInstruments.length * 3 +
      matchedGenres.length * 2 +
      distanceBonus;

    return {
      ...row,
      candidateInstruments,
      candidateGenres,
      matchedInstruments,
      matchedGenres,
      distanceKm,
      score,
    };
  });

  // Sort by score descending, limit to MAX_SUGGESTIONS
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, MAX_SUGGESTIONS);

  const suggestions: SuggestionProfile[] = top.map((s) => ({
    id: s.id,
    displayName: s.displayName,
    bio: s.bio,
    skillLevel: s.skillLevel,
    city: s.city,
    lat: s.lat,
    lng: s.lng,
    avatarKey: s.avatarKey,
    avatarUrl: s.avatarUrl,
    name: s.name,
    instruments: s.candidateInstruments,
    genres: s.candidateGenres,
    matchedOn: {
      instruments: s.matchedInstruments,
      genres: s.matchedGenres,
      distanceKm: Math.round(s.distanceKm * 10) / 10,
    },
    score: Math.round(s.score * 10) / 10,
  }));

  return { suggestions, total: suggestions.length };
}
