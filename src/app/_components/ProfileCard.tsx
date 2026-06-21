import Link from "next/link";
import { cn } from "@/lib/cn";

interface ProfileCardProps {
  id: string;
  displayName: string;
  instruments: string[];
  genres: string[];
  skillLevel: string;
  city: string;
  avatarUrl?: string | null;
  className?: string;
}

const MAX_INSTRUMENTS = 3;
const MAX_GENRES = 2;

const SKILL_STYLES: Record<string, string> = {
  beginner: "bg-slate-700 text-slate-300 border-slate-600",
  intermediate: "bg-blue-900/30 text-blue-300 border-blue-800",
  advanced: "bg-purple-900/30 text-purple-300 border-purple-800",
  pro: "bg-amber-900/30 text-amber-300 border-amber-800",
};

const SKILL_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  pro: "Pro",
};

export function ProfileCard({
  id,
  displayName,
  instruments,
  genres,
  skillLevel,
  city,
  avatarUrl,
  className,
}: ProfileCardProps) {
  const instrumentDisplay = instruments.slice(0, MAX_INSTRUMENTS);
  const instrumentOverflow = instruments.length - MAX_INSTRUMENTS;
  const genreDisplay = genres.slice(0, MAX_GENRES);
  const genreOverflow = genres.length - MAX_GENRES;
  const skillStyle =
    SKILL_STYLES[skillLevel] ?? SKILL_STYLES.beginner;
  const skillLabel =
    SKILL_LABELS[skillLevel] ?? skillLevel;

  return (
    <Link
      href={`/es/profile/${id}`}
      className={cn(
        "block rounded-xl border border-slate-800 bg-slate-900 p-5 transition-all hover:border-slate-600 hover:bg-slate-800/50",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-14 w-14 rounded-full border-2 border-slate-700 object-cover"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-500">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">
            {displayName}
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">{city}</p>

          {/* Skill badge */}
          <div className="mt-2">
            <span
              className={cn(
                "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
                skillStyle,
              )}
            >
              {skillLabel}
            </span>
          </div>

          {/* Instruments */}
          {instruments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {instrumentDisplay.map((inst) => (
                <span
                  key={inst}
                  className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300"
                >
                  {inst}
                </span>
              ))}
              {instrumentOverflow > 0 && (
                <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-xs text-slate-500">
                  +{instrumentOverflow}
                </span>
              )}
            </div>
          )}

          {/* Genres */}
          {genres.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {genreDisplay.map((genre) => (
                <span
                  key={genre}
                  className="text-xs text-slate-500"
                >
                  {genre}
                </span>
              ))}
              {genreOverflow > 0 && (
                <span className="text-xs text-slate-600">
                  +{genreOverflow}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
