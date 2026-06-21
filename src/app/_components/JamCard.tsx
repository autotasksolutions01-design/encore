import Link from "next/link";
import type { JamStatus } from "@prisma/client";

interface JamCardProps {
  id: string;
  title: string;
  genre: string;
  dateTime: string;
  locationName: string;
  description: string | null;
  status: JamStatus;
  responseCount: number;
  userHasResponded: string | null;
  creator: {
    id: string;
    displayName: string;
    skillLevel: string;
    city: string;
  };
}

export function JamCard({
  id,
  title,
  genre,
  dateTime,
  locationName,
  description,
  status,
  responseCount,
  userHasResponded,
  creator,
}: JamCardProps) {
  const date = new Date(dateTime);
  const formattedDate = date.toLocaleDateString("es-AR", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/es/jams/${id}`}
      className="block rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-700 transition-colors p-5 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-600/20 text-brand-400">
              {genre}
            </span>
            {status !== "active" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                {status === "cancelled" ? "Cancelada" : "Expirada"}
              </span>
            )}
            {userHasResponded && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                {userHasResponded === "going" ? "✓ Voy" : "✓ Me interesa"}
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
            {title}
          </h3>

          {description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-slate-200">{formattedDate}</p>
          <p className="text-xs text-slate-500">{formattedTime}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
            {creator.displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-400">{creator.displayName}</span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{locationName}</span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span>
            {responseCount}{" "}
            {responseCount === 1 ? "respuesta" : "respuestas"}
          </span>
        </div>
      </div>
    </Link>
  );
}
