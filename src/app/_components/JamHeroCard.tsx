import Link from "next/link";
import type { JamStatus } from "@prisma/client";

type Responder = {
  name: string;
  response: string;
};

interface JamHeroCardProps {
  id: string;
  title: string;
  genre: string;
  dateTime: Date;
  locationName: string;
  responseCount: number;
  userHasResponded: string | null;
  responders: Responder[];
  distanceKm?: number;
  userLat?: number;
  userLng?: number;
}

function formatCountdown(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return "Ahora";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `Empieza en ${diffMins} min`;
  if (diffHours < 24) return `Empieza en ${diffHours}h`;
  return "";
}

function formatHeroDateTime(date: Date): { timeFull: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (date < tomorrow) {
    return { timeFull: `Hoy ${timeStr}` };
  }
  if (date < new Date(tomorrow.getTime() + 86400000)) {
    return { timeFull: `Mañana ${timeStr}` };
  }

  const dayName = date.toLocaleDateString("es-AR", { weekday: "long" });
  return { timeFull: `${dayName} ${timeStr}` };
}

function formatDistance(km?: number): string | null {
  if (km === undefined || km === null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function getAvatarColors(index: number): string {
  const colors = [
    "bg-brand-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-rose-500",
  ];
  return colors[index % colors.length];
}

export function JamHeroCard({
  id,
  title,
  genre,
  dateTime,
  locationName,
  responseCount,
  userHasResponded,
  responders,
  distanceKm,
}: JamHeroCardProps) {
  const countdown = formatCountdown(dateTime);
  const { timeFull } = formatHeroDateTime(dateTime);
  const distance = formatDistance(distanceKm);

  const goingResponders = responders.filter((r) => r.response === "going");
  const displayAvatars =
    goingResponders.length > 0
      ? goingResponders.slice(0, 4)
      : responders.slice(0, 4);

  const goingLabel =
    responseCount > 0
      ? `${responseCount} ${responseCount === 1 ? "músico" : "músicos"}`
      : "Sé el primero";

  return (
    <Link
      href={`/es/jams/${id}`}
      className="block relative rounded-[22px] overflow-hidden cursor-pointer mb-[26px] border border-[#2a3140] group"
      style={{
        background: "linear-gradient(135deg, #1d2742, #0d1117)",
        boxShadow: "0 18px 40px rgba(0,0,0,.32)",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 90% at 85% 10%, rgba(92,124,250,.4), transparent 60%)",
        }}
      />
      <div className="relative p-[22px] pb-5">
        <div className="flex items-center gap-2 mb-auto">
          {countdown && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-400 text-[11.5px] font-bold tracking-[0.4px] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {countdown}
            </span>
          )}
          <span className="bg-white/10 text-slate-200 text-[11.5px] font-semibold px-2.5 py-1 rounded-full capitalize">
            {genre}
          </span>
          {userHasResponded && (
            <span className="bg-green-500/15 text-green-400 text-[11.5px] font-semibold px-2.5 py-1 rounded-full">
              {userHasResponded === "going" ? "✓ Voy" : "✓ Me interesa"}
            </span>
          )}
        </div>

        <h2 className="font-[family-name:var(--font-space-grotesk)] text-white font-bold text-[25px] tracking-[-0.5px] mt-[46px] mb-1.5 leading-tight">
          {title}
        </h2>

        <div className="flex items-center gap-2 text-slate-300 text-[13.5px] mb-[18px]">
          <span className="font-semibold text-white">{timeFull}</span>
          <span className="opacity-50">·</span>
          <span>{locationName}</span>
          {distance && (
            <>
              <span className="opacity-50">·</span>
              <span>{distance}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center">
            {displayAvatars.length > 0 ? (
              <>
                {displayAvatars.map((r, i) => (
                  <div
                    key={i}
                    className="w-[30px] h-[30px] rounded-full -ml-2 first:ml-0 border-2 border-[#16203a] flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: getAvatarColors(i) }}
                  >
                    {(r.name || "U").charAt(0).toUpperCase()}
                  </div>
                ))}
                <span className="ml-2.5 text-[13px] text-slate-300 font-[550]">
                  {goingLabel}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-slate-400 font-[550]">
                {goingLabel}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 bg-white text-slate-900 text-[13px] font-semibold px-4 py-2 rounded-[11px] group-hover:bg-brand-100 transition-colors">
            Ver jam →
          </span>
        </div>
      </div>
    </Link>
  );
}
