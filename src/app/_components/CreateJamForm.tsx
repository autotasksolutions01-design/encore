"use client";

import { useState } from "react";

/**
 * CreateJamForm — modal/dialog for creating a new jam session.
 *
 * R34: Authenticated users MUST create jam session posts with:
 * title, genre, date/time, location, description.
 * Max 10 active jams per user.
 */
export function CreateJamForm() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setTitle("");
    setGenre("");
    setDateTime("");
    setLocationName("");
    setDescription("");
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      // Default location: Buenos Aires center
      const lat = -34.588;
      const lng = -58.431;

      const res = await fetch("/api/jams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          genre,
          dateTime,
          lat,
          lng,
          locationName,
          description: description || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create jam");
      }

      setSuccess(true);
      // Refresh the page to show the new jam
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create jam",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        aria-label="Crear jam"
      >
        + Crear jam
      </button>

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Crear nueva jam"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Crear jam</h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="text-center py-8">
                <p className="text-green-400 font-medium mb-2">
                  ¡Jam creada!
                </p>
                <p className="text-sm text-slate-400">
                  Recargando página...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="jam-title"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Título *
                  </label>
                  <input
                    id="jam-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={200}
                    placeholder='Ej: "Jazz jam en Palermo"'
                    className="w-full bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="jam-genre"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Género *
                  </label>
                  <select
                    id="jam-genre"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    required
                    className="w-full bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm border border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">Seleccionar género</option>
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
                    <option value="metal">Metal</option>
                    <option value="pop">Pop</option>
                    <option value="hiphop">Hip Hop</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="jam-datetime"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Fecha y hora *
                  </label>
                  <input
                    id="jam-datetime"
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    required
                    className="w-full bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="jam-location"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Lugar *
                  </label>
                  <input
                    id="jam-location"
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    required
                    maxLength={200}
                    placeholder='Ej: "Thelonious Club"'
                    className="w-full bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-slate-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="jam-description"
                    className="block text-sm font-medium text-slate-300 mb-1"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="jam-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Detalles adicionales..."
                    className="w-full bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-slate-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? "Creando..." : "Crear jam"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
