import { prisma } from "@/lib/prisma";
import { CreateJamForm } from "@/app/_components/CreateJamForm";
import { JamCard } from "@/app/_components/JamCard";
import { auth } from "@/lib/auth";
import type { JamStatus } from "@prisma/client";

const RESULTS_PER_PAGE = 20;
const MAX_RADIUS_KM = 500;

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
  const conditions: string[] = ['js."status" = \'active\'', 'js."dateTime" > NOW()'];
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
        ) as "responseCount"
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Jams</h1>
          <p className="text-sm text-slate-400 mt-1">
            Encontrá y organizá encuentros musicales cerca tuyo.
          </p>
        </div>
        {isAuthenticated && <CreateJamForm />}
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3" method="GET">
        <select
          name="genre"
          defaultValue={genre ?? ""}
          className="bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          aria-label="Filtrar por género"
        >
          <option value="">Todos los géneros</option>
          <option value="rock">Rock</option>
          <option value="jazz">Jazz</option>
          <option value="blues">Blues</option>
          <option value="funk">Funk</option>
          <option value="indie">Indie</option>
          <option value="electronica">Electrónica</option>
          <option value="folk">Folk</option>
          <option value="clasica">Clásica</option>
          <option value="tango">Tango</option>
          <option value="reggae">Reggae</option>
        </select>
        {/* Hidden fields preserve lat/lng from JS geolocation */}
        <input type="hidden" name="lat" value={latStr ?? ""} />
        <input type="hidden" name="lng" value={lngStr ?? ""} />
        {hasSpatial && (
          <select
            name="radius"
            defaultValue={radius?.toString() ?? "50"}
            className="bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Radio de búsqueda"
          >
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
            <option value="100">100 km</option>
          </select>
        )}
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Filtrar
        </button>
      </form>

      {/* Geolocation helper */}
      {!hasSpatial && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <p className="text-sm text-slate-400">
            Activá tu ubicación para ver jams cerca tuyo.
          </p>
          <button
            type="button"
            className="mt-2 text-sm text-brand-400 hover:text-brand-300"
            id="geolocate-btn"
          >
            Usar mi ubicación
          </button>
        </div>
      )}

      {/* Results */}
      <div>
        {total > 0 && (
          <p className="text-sm text-slate-400 mb-4">
            {total} jam{total !== 1 ? "s" : ""}{" "}
            {genre ? `de ${genre}` : ""}{" "}
            {hasSpatial ? `en un radio de ${radius ?? 50}km` : ""}
          </p>
        )}

        {jams.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400 text-lg">
              {genre || hasSpatial
                ? "No se encontraron jams con esos filtros."
                : "No hay jams activas. ¡Creá la primera!"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jams.map((jam) => (
              <JamCard
                key={jam.id}
                id={jam.id}
                title={jam.title}
                genre={jam.genre}
                dateTime={jam.dateTime.toISOString()}
                locationName={jam.locationName}
                description={jam.description}
                status={jam.status as JamStatus}
                responseCount={jam.responseCount}
                userHasResponded={jam.userHasResponded}
                creator={{
                  id: jam.creatorId,
                  displayName: jam.creatorName,
                  skillLevel: jam.creatorSkillLevel,
                  city: jam.creatorCity,
                }}
              />
            ))}
          </div>
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
