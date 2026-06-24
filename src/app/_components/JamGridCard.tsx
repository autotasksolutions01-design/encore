import Link from "next/link";
import type { JamStatus } from "@prisma/client";

type Responder = {
  name: string;
  response: string;
};

interface JamGridCardProps {
  id: string;
  title: string;
  genre: string;
  dateTime: Date;
  locationName: string;
  responseCount: number;
  userHasResponded: string | null;
  responders: Responder[];
  distanceKm?: number;
}

function formatDistance(km?: number): string | null {
  if (km === undefined || km === null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function getAvatarColors(index: number): string {
  const colors = [
    "#5c7cfa",
    "#f59e0b",
    "#10b981",
    "#f43f5e",
  ];
  return colors[index % colors.length];
}

export function JamGridCard({
  id,
  title,
  genre,
  dateTime,
  locationName,
  responseCount,
  userHasResponded,
  responders,
  distanceKm,
}: JamGridCardProps) {
  const hours = dateTime.getHours().toString().padStart(2, "0");
  const mins = dateTime.getMinutes().toString().padStart(2, "0");

  const distance = formatDistance(distanceKm);

  const goingResponders = responders.filter((r) => r.response === "going");
  const displayAvatars =
    goingResponders.length > 0
      ? goingResponders.slice(0, 4)
      : responders.slice(0, 4);

  const goingLabel =
    responseCount > 0
      ? `${responseCount} ${responseCount === 1 ? "músico" : "músicos"}`
      : "Sin respuestas";

  return (
    <Link
      href={`/es/jams/${id}`}
      className="relative flex gap-[14px] p-[15px] rounded-[18px] bg-[#161b22] border border-[#2a3140] hover:border-slate-600 transition-colors group"
    >
      <div className="flex-shrink-0 w-[54px] text-center">
        <div className="font-[family-name:var(--font-space-grotesk)] text-white font-bold text-[19px] leading-none">
          {hours}
        </div>
        <div className="text-[11px] text-[#6b7785] mt-[3px]">{mins}</div>
      </div>

      <div className="w-px bg-[#2a3140]" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[7px] mb-[5px]">
          <span className="bg-brand-500/14 text-brand-400 text-[10.5px] font-semibold px-2 py-[3px] rounded-full capitalize">
            {genre}
          </span>
          {userHasResponded && (
            <span className="bg-green-500/15 text-green-400 text-[10.5px] font-semibold px-2 py-[3px] rounded-full">
              {userHasResponded === "going" ? "✓ Voy" : "✓ Me interesa"}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-[16px] mb-[5px] leading-tight text-white group-hover:text-brand-400 transition-colors">
          {title}
        </h3>

        <div className="flex items-center gap-1.5 text-[12.5px] text-[#9aa7b5]">
          <span>{locationName}</span>
          {distance && (
            <>
              <span className="opacity-50">·</span>
              <span>{distance}</span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between mt-[11px]">
          <div className="flex items-center">
            {displayAvatars.length > 0 ? (
              <>
                {displayAvatars.map((r, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full -ml-[7px] first:ml-0 border-2 border-[#161b22] flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: getAvatarColors(i) }}
                  >
                    {(r.name || "U").charAt(0).toUpperCase()}
                  </div>
                ))}
                <span className="ml-[9px] text-xs text-[#6b7785]">
                  {goingLabel}
                </span>
              </>
            ) : (
              <span className="text-xs text-[#6b7785]">{goingLabel}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
