import { SearchFilters } from "@/app/_components/SearchFilters";
import { ProfileCard } from "@/app/_components/ProfileCard";
import { discoverProfiles } from "@/lib/discovery";

interface DiscoverPageProps {
  searchParams: Promise<{
    instrument?: string;
    genre?: string;
    location?: string;
    lat?: string;
    lng?: string;
    radius?: string;
    skill?: string;
    page?: string;
  }>;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const sp = await searchParams;

  const instrument = sp.instrument;
  const genre = sp.genre;
  const location = sp.location;
  const latStr = sp.lat;
  const lngStr = sp.lng;
  const radiusStr = sp.radius;
  const skill = sp.skill;
  const pageStr = sp.page;

  const lat = latStr ? parseFloat(latStr) : undefined;
  const lng = lngStr ? parseFloat(lngStr) : undefined;
  const radius = radiusStr ? parseInt(radiusStr, 10) : undefined;
  const page = pageStr ? parseInt(pageStr, 10) : undefined;

  const hasFilters = !!(instrument || genre || lat !== undefined || skill);

  let result = {
    profiles: [] as {
      id: string;
      displayName: string;
      bio: string;
      skillLevel: string;
      city: string;
      instruments: string[];
      genres: string[];
      avatarKey: string | null;
      avatarUrl: string | null;
      name: string | null;
      publishedAt: Date | null;
    }[],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };

  if (hasFilters) {
    try {
      result = await discoverProfiles({
        instrument,
        genre,
        lat,
        lng,
        radiusKm: radius,
        skillLevel: skill,
        page,
      });
    } catch {
      // Discovery failed silently — show empty state
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Descubrí músicos</h1>
        <p className="text-sm text-slate-400 mt-1">
          Conectá con músicos según instrumento, género y ubicación.
        </p>
      </div>

      <SearchFilters
        defaultInstrument={instrument}
        defaultGenre={genre}
        defaultLat={lat && !isNaN(lat) ? lat : undefined}
        defaultLng={lng && !isNaN(lng) ? lng : undefined}
        defaultRadius={radius && !isNaN(radius) ? radius : undefined}
        defaultSkill={skill}
        defaultLocation={location}
      />

      {/* Results */}
      {hasFilters && (
        <div>
          <p className="text-sm text-slate-400 mb-4">
            {result.total === 0
              ? "No se encontraron músicos. Probá ampliando los filtros."
              : `${result.total} músico${result.total !== 1 ? "s" : ""} encontrado${result.total !== 1 ? "s" : ""}`}
          </p>

          {result.profiles.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  id={profile.id}
                  displayName={profile.displayName}
                  instruments={profile.instruments}
                  genres={profile.genres}
                  skillLevel={profile.skillLevel}
                  city={profile.city}
                  avatarUrl={profile.avatarUrl}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {result.total > result.pageSize && (
            <div className="flex items-center justify-center gap-4 mt-8">
              {result.page > 1 && (
                <a
                  href={`/es/discover?${buildPageUrl(sp, result.page - 1)}`}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  ← Anterior
                </a>
              )}
              <span className="text-sm text-slate-400">
                Página {result.page} de{" "}
                {Math.ceil(result.total / result.pageSize)}
              </span>
              {result.hasMore && (
                <a
                  href={`/es/discover?${buildPageUrl(sp, result.page + 1)}`}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Siguiente →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state: no filters applied */}
      {!hasFilters && (
        <div className="text-center py-20">
          <div className="text-5xl mb-6 animate-bounce">🎸</div>
          <p className="text-slate-400 text-lg">
            Aplicá filtros para descubrir músicos cerca tuyo.
          </p>
        </div>
      )}
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
