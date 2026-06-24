"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const GENRES = [
  { value: "rock", label: "Rock" },
  { value: "jazz", label: "Jazz" },
  { value: "blues", label: "Blues" },
  { value: "funk", label: "Funk" },
  { value: "indie", label: "Indie" },
  { value: "electronica", label: "Electrónica" },
  { value: "folk", label: "Folk" },
  { value: "clasica", label: "Clásica" },
  { value: "tango", label: "Tango" },
  { value: "reggae", label: "Reggae" },
] as const;

function buildGenreUrl(
  currentParams: URLSearchParams,
  genre: string | null,
): string {
  const params = new URLSearchParams(currentParams.toString());
  if (genre) {
    params.set("genre", genre);
  } else {
    params.delete("genre");
  }
  params.delete("page");
  return `/es/jams?${params.toString()}`;
}

export function GenreChips() {
  const searchParams = useSearchParams();
  const currentGenre = searchParams.get("genre");

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1.5 mb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filtrar por género"
    >
      {GENRES.map((g) => {
        const isActive = currentGenre === g.value;
        return (
          <Link
            key={g.value}
            href={buildGenreUrl(searchParams, isActive ? null : g.value)}
            scroll={false}
            className={cn(
              "flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-[550] border transition-colors whitespace-nowrap",
              isActive
                ? "border-brand-500 bg-brand-600/20 text-brand-300"
                : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300",
            )}
          >
            {g.label}
          </Link>
        );
      })}
    </div>
  );
}
