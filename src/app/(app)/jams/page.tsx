import { prisma } from "@/lib/prisma";
import { CreateJamForm } from "@/app/_components/CreateJamForm";
import { GenreChips } from "@/app/_components/GenreChips";
import { JamHeroCard } from "@/app/_components/JamHeroCard";
import { JamGridCard } from "@/app/_components/JamGridCard";
import { auth } from "@/lib/auth";

const RESULTS_PER_PAGE = 20;
const MAX_RADIUS_KM = 500;

type JamResponder = {
  name: string;
  response: string;
};

interface JamsPageProps {
  searchParams: Promise<{
    genre?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    page?: string;
  }>;
}

export default async function JamsPage({ searchParams }: JamsPageProps) {
  const sp = await searchParams;

  const session = await auth();
  const isAuthenticated = !!session?.user?.id;

  const genre = sp.genre;
  const latStr = sp.lat;
  const lngStr = sp.lng;
  const radiusStr = sp.radius;
  const pageStr = sp.page;

  const lat = latStr ? parseFloat(latStr) : undefined;
  const lng = lngStr ? parseFloat(lngStr) : undefined;
  const radius = radiusStr ? parseInt(radiusStr, 10) : undefined;
  const page = pageStr ? parseInt(pageStr, 10) : 1;

  const hasSpatial =
    lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng);

  // Build query for active, future jams
  const conditions: string[] = [
    'js."status" = \'active\'',
    'js."dateTime" > NOW()',
  ];
  const queryParams: (string | number)[] = [];
  let paramIdx = 0;

  if (genre) {
    paramIdx++;
    conditions.push(`js."genre" = $${paramIdx}`);
    queryParams.push(genre);
  }

  if (hasSpatial) {
    paramIdx++;
    const lngParam = paramIdx;
    paramIdx++;
    const latParam = paramIdx;
    paramIdx++;
    const radiusParam = paramIdx;
    const effectiveRadius = Math.min(radius ?? 50, MAX_RADIUS_KM);
    conditions.push(
      `ST_DWithin(ST_MakePoint(js."lng", js."lat")::geography, ST_MakePoint($${lngParam}, $${latParam})::geography, $${radiusParam} * 1000)`,
    );
    queryParams.push(lng!, lat!, effectiveRadius);
  }

  const whereClause = conditions.join(" AND ");

  // Count
  const offset = (Math.max(1, page) - 1) * RESULTS_PER_PAGE;

  const countSql = `SELECT COUNT(*)::int AS total FROM "JamSession" js WHERE ${whereClause}`;
  const countResult = await prisma.$queryRawUnsafe<{ total: number }[]>(
    countSql,
    ...queryParams,
  );
  const total = countResult[0]?.total ?? 0;

  let jams: {
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
    creatorCity: string;
    responseCount: number;
    responders: JamResponder[];
    userHasResponded: string | null;
  }[] = [];

  if (total > 0) {
    const dataSql = `
      SELECT
        js.id, js.title, js.genre, js."dateTime", js.lat, js.lng,
        js."locationName", js.description, js.status, js."createdAt",
        js."creatorId",
        p."displayName" as "creatorName",
        p."skillLevel" as "creatorSkillLevel",
        p.city as "creatorCity",
        (
          SELECT COUNT(*)::int
          FROM "JamResponse" jr
          WHERE jr."jamId" = js.id
        ) as "responseCount",
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'name', COALESCE(u.name, ''),
              'response', jr.response::text
            ) ORDER BY jr."createdAt" ASC)
            FROM "JamResponse" jr
            JOIN "User" u ON u.id = jr."userId"
            WHERE jr."jamId" = js.id
          ),
          '[]'::json
        ) as "responders"
        ${
          isAuthenticated
            ? `, (
              SELECT jr2."response"::text
              FROM "JamResponse" jr2
              WHERE jr2."jamId" = js.id AND jr2."userId" = '${session.user!.id}'
              LIMIT 1
            ) as "userHasResponded"`
            : ""
        }
      FROM "JamSession" js
      JOIN "Profile" p ON p.id = js."creatorId"
      WHERE ${whereClause}
      ORDER BY js."dateTime" ASC
      LIMIT ${RESULTS_PER_PAGE} OFFSET ${offset}
    `;

    jams = await prisma.$queryRawUnsafe<typeof jams>(dataSql, ...queryParams);
  }

  const hasMore = offset + RESULTS_PER_PAGE < total;
  const totalPages = Math.ceil(total / RESULTS_PER_PAGE);

  // Hero jam only on page 1
  const heroJam = page === 1 && jams.length > 0 ? jams[0] : null;
  const gridJams = heroJam ? jams.slice(1) : jams;

  // Group remaining jams by temporal buckets
  const groups = groupJamsByTemporalBucket(gridJams);

  // Compute distances if spatial params present
  function getDistanceKm(jamLat: number, jamLng: number): number | undefined {
    if (!hasSpatial) return undefined;
    return haversineDistance(lat!, lng!, jamLat, jamLng);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-white font-bold text-[30px] tracking-[-0.8px]">
            Jams
          </h1>
          <p className="text-sm text-[#9aa7b5] mt-1">
            Encontrá y organizá encuentros musicales cerca tuyo.
          </p>
        </div>
        {isAuthenticated && <CreateJamForm />}
      </div>

      {/* Location hint */}
      <button
        type="button"
        className="inline-flex items-center gap-1.5 bg-transparent border-none text-[#9aa7b5] text-[13px] cursor-pointer p-0 mb-1"
        id="geolocate-btn"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {hasSpatial
          ? `Buenos Aires · ${Math.min(radius ?? 50, MAX_RADIUS_KM)} km`
          : "Activá tu ubicación para ver jams cerca"}
        <span className="text-[#6b7785]">▾</span>
      </button>

      {/* Genre chips */}
      <GenreChips />

      {/* Radius filter — compact inline */}
      <form className="flex flex-wrap items-center gap-2 mb-4" method="GET">
        <input type="hidden" name="genre" value={genre ?? ""} />
        <input type="hidden" name="lat" value={latStr ?? ""} />
        <input type="hidden" name="lng" value={lngStr ?? ""} />
        {hasSpatial && (
          <select
            name="radius"
            defaultValue={radius?.toString() ?? "50"}
            className="bg-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Radio de búsqueda"
          >
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
          </select>
        )}
        {hasSpatial && (
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            Actualizar radio
          </button>
        )}
      </form>

      {/* Results */}
      <div>
        {/* Hero jam */}
        {heroJam && (
          <JamHeroCard
            id={heroJam.id}
            title={heroJam.title}
            genre={heroJam.genre}
            dateTime={new Date(heroJam.dateTime)}
            locationName={heroJam.locationName}
            responseCount={heroJam.responseCount}
            userHasResponded={heroJam.userHasResponded}
            responders={heroJam.responders}
            distanceKm={getDistanceKm(heroJam.lat, heroJam.lng)}
            userLat={lat}
            userLng={lng}
          />
        )}

        {/* Temporal groups */}
        {groups.length === 0 && jams.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">
              {genre || hasSpatial
                ? "No se encontraron jams con esos filtros."
                : "No hay jams activas. ¡Creá la primera!"}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-[22px]">
              <div className="font-[family-name:var(--font-space-grotesk)] text-xs font-semibold tracking-[1.2px] text-[#6b7785] uppercase mb-[11px]">
                {group.label}
              </div>
              <div className="flex flex-col gap-3">
                {group.items.map((jam) => (
                  <JamGridCard
                    key={jam.id}
                    id={jam.id}
                    title={jam.title}
                    genre={jam.genre}
                    dateTime={new Date(jam.dateTime)}
                    locationName={jam.locationName}
                    responseCount={jam.responseCount}
                    userHasResponded={jam.userHasResponded}
                    responders={jam.responders}
                    distanceKm={getDistanceKm(jam.lat, jam.lng)}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Pagination */}
        {total > RESULTS_PER_PAGE && (
          <div className="flex items-center justify-center gap-4 mt-8">
            {page > 1 && (
              <a
                href={`/es/jams?${buildPageUrl(sp, page - 1)}`}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                ← Anterior
              </a>
            )}
            <span className="text-sm text-slate-400">
              Página {page} de {totalPages}
            </span>
            {hasMore && (
              <a
                href={`/es/jams?${buildPageUrl(sp, page + 1)}`}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Siguiente →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildPageUrl(
  sp: Record<string, string | undefined>,
  page: number,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value !== undefined && key !== "page") {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  return params.toString();
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTemporalBucketLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  // Rest of this week (Sun to Sat, where Sunday=0)
  const endOfWeek = new Date(today);
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);

  if (date < tomorrow) return "Hoy";
  if (date < dayAfterTomorrow) return "Mañana";

  if (date < endOfWeek) {
    return date.toLocaleDateString("es-AR", { weekday: "long" });
  }

  return date.toLocaleDateString("es-AR", {
    month: "long",
    day: "numeric",
  });
}

function groupJamsByTemporalBucket(
  jams: {
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
    creatorCity: string;
    responseCount: number;
    responders: JamResponder[];
    userHasResponded: string | null;
  }[],
): { label: string; items: typeof jams }[] {
  const groups: { label: string; items: typeof jams }[] = [];

  for (const jam of jams) {
    const label = getTemporalBucketLabel(new Date(jam.dateTime));
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(jam);
  }

  return groups;
}
