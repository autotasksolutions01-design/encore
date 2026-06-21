"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const INSTRUMENTS = [
  "guitar", "bass", "drums", "piano", "keyboard", "violin",
  "cello", "trumpet", "saxophone", "flute", "clarinet", "trombone",
  "voice", "ukulele", "harmonica", "accordion", "synth", "percussion",
] as const;

const GENRES = [
  "rock", "pop", "jazz", "blues", "funk", "soul", "reggae",
  "electronic", "hip-hop", "classical", "folk", "metal", "punk",
  "indie", "latin", "tango", "cumbia", "salsa",
] as const;

const SKILL_LEVELS = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
  { value: "pro", label: "Pro" },
] as const;

interface SearchFiltersProps {
  defaultInstrument?: string;
  defaultGenre?: string;
  defaultLat?: number;
  defaultLng?: number;
  defaultRadius?: number;
  defaultSkill?: string;
  defaultLocation?: string;
}

export function SearchFilters({
  defaultInstrument,
  defaultGenre,
  defaultLat,
  defaultLng,
  defaultRadius,
  defaultSkill,
  defaultLocation,
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [instrument, setInstrument] = useState(defaultInstrument ?? "");
  const [genre, setGenre] = useState(defaultGenre ?? "");
  const [location, setLocation] = useState(defaultLocation ?? "");
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [radius, setRadius] = useState(defaultRadius ?? 50);
  const [skill, setSkill] = useState(defaultSkill ?? "");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState("");

  // Sync with URL searchParams on mount
  useEffect(() => {
    const inst = searchParams.get("instrument");
    const gen = searchParams.get("genre");
    const loc = searchParams.get("location") ?? "";
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const r = searchParams.get("radius");
    const s = searchParams.get("skill");

    if (inst) setInstrument(inst);
    if (gen) setGenre(gen);
    if (loc) setLocation(loc);
    if (latStr) setLat(parseFloat(latStr));
    if (lngStr) setLng(parseFloat(lngStr));
    if (r) setRadius(parseInt(r, 10));
    if (s) setSkill(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (instrument) params.set("instrument", instrument);
    if (genre) params.set("genre", genre);
    if (lat !== undefined && lng !== undefined) {
      params.set("lat", String(lat));
      params.set("lng", String(lng));
      params.set("radius", String(radius));
    }
    if (location) params.set("location", location);
    if (skill) params.set("skill", skill);
    params.set("page", "1");
    return `/es/discover?${params.toString()}`;
  };

  const handleSearch = () => {
    router.push(buildUrl());
  };

  const handleClear = () => {
    setInstrument("");
    setGenre("");
    setLocation("");
    setLat(undefined);
    setLng(undefined);
    setRadius(50);
    setSkill("");
    setGeoError("");
    router.push("/es/discover");
  };

  const handleLocationBlur = async () => {
    if (!location.trim() || location === defaultLocation) return;
    setGeoError("");

    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      );
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
        handleSearch();
      } else {
        setGeoError("Ubicación no encontrada");
      }
    } catch {
      setGeoError("Error al buscar ubicación");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (location.trim() && (lat === undefined || location !== defaultLocation)) {
        handleLocationBlur();
      } else {
        handleSearch();
      }
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Instrument + Genre row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Instrumento
          </label>
          <select
            value={instrument}
            onChange={(e) => {
              setInstrument(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {INSTRUMENTS.map((inst) => (
              <option key={inst} value={inst}>
                {inst.charAt(0).toUpperCase() + inst.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Género
          </label>
          <select
            value={genre}
            onChange={(e) => {
              setGenre(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Location + Skill row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Ubicación
          </label>
          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={handleLocationBlur}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Buenos Aires"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
            {isGeocoding && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                Buscando...
              </span>
            )}
          </div>
          {geoError && (
            <p className="mt-1 text-xs text-red-400">{geoError}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Nivel
          </label>
          <select
            value={skill}
            onChange={(e) => {
              setSkill(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Todos</option>
            {SKILL_LEVELS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Radius slider (only when location is set) */}
      {lat !== undefined && lng !== undefined && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Radio: {radius} km
          </label>
          <input
            type="range"
            min={1}
            max={500}
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value, 10))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>1 km</span>
            <span>500 km</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSearch}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "bg-brand-600 text-white hover:bg-brand-500",
          )}
        >
          Buscar
        </button>
        <button
          onClick={handleClear}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
