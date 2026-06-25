"use client";

import { usePathname } from "next/navigation";

interface Note {
  head: string;
  body: string;
}

interface NotesSet {
  title: string;
  list: Note[];
}

const NOTES: Record<string, NotesSet> = {
  jams: {
    title: "Jams",
    list: [
      { head: "Agrupar por cercanía temporal", body: "la pregunta de un músico es \"¿qué toco esta noche?\", no \"mostrame 20 resultados\". Hoy / Mañana / finde en vez de paginación." },
      { head: "Card destacada con cuenta regresiva", body: "la jam más próxima recibe peso visual y urgencia (\"empieza en 3h\"). Prioriza la decisión inmediata." },
      { head: "Stack de quién va + instrumentos", body: "un músico decide ir según con quién toca. Mostramos avatares y, en el detalle, qué instrumentos faltan." },
      { head: "Filtros como chips, no dropdown", body: "el <select> nativo del MVP es lento en mobile. Chips horizontales = scan y filtrado de un tap." },
    ],
  },
  detail: {
    title: "Detalle de jam",
    list: [
      { head: "Barra de respuesta fija", body: "\"Voy / Me interesa\" siempre visible al hacer scroll, con confirmación celebratoria. En el MVP el botón vive perdido junto al título de respuestas." },
      { head: "Audio del organizador embebido", body: "el modelo ya tiene AudioClip + waveform. Escuchar antes de comprometerte responde \"¿está al nivel?\" sin salir de la pantalla." },
      { head: "Lineup con instrumento", body: "ver \"Diego — bajo, va\" responde de un vistazo \"¿falta lo mío?\". Convierte la lista de respuestas en información útil para decidir." },
    ],
  },
  discover: {
    title: "Buscar",
    list: [
      { head: "Cold-start cálido", body: "el MVP muestra una guitarra que rebota hasta aplicar filtros. Acá \"Sugeridos para vos\" aparece de entrada usando el motor de suggestions que ya existe en el repo." },
      { head: "Audio en cada card", body: "el diferenciador de Encore es el oído, no el texto. Un waveform reproducible por card hace que descubrir sea escuchar." },
      { head: "\"Conectar\" es un botón real", body: "en ProfileCard.tsx el \"Conectar\" es un <span> decorativo dentro del Link al perfil — no hace nada. Acá es una acción con estado (Conectar → Pendiente)." },
    ],
  },
  profile: {
    title: "Perfil",
    list: [
      { head: "Audio al frente", body: "el portfolio sonoro es la carta de presentación de un músico. Demos con waveform arriba, antes que la biografía." },
      { head: "Chips de intención", body: "el modelo LookingFor (banda/jam/sesión/colaboración) comunica de un vistazo qué busca la persona. Filtra el match antes del mensaje." },
      { head: "CTAs claros, moderación accesible", body: "Conectar / Mensaje fijos abajo; bloquear y reportar existen (modelos Block/Report) pero sin fricción, en overflow." },
    ],
  },
  messages: {
    title: "Mensajes",
    list: [
      { head: "Plantillas de intro marcadas", body: "el modelo tiene isIntroTemplate. Bajar la barrera del primer mensaje es clave en redes de conexión — lo hacemos visible y sugerido." },
      { head: "Ticks de estado", body: "enviado / entregado / leído (MessageStatus ya existe) dan confianza de que el contacto llegó, algo crítico antes de coordinar un encuentro real." },
    ],
  },
};

function screenFromPath(pathname: string): keyof typeof NOTES {
  if (pathname.startsWith("/es/jams/")) return "detail";
  if (pathname.startsWith("/es/jams")) return "jams";
  if (pathname.startsWith("/es/discover")) return "discover";
  if (pathname.startsWith("/es/profile/")) return "profile";
  if (pathname.startsWith("/es/profile")) return "profile";
  if (pathname.startsWith("/es/messages/")) return "messages";
  if (pathname.startsWith("/es/messages")) return "messages";
  if (pathname.startsWith("/es/connections")) return "profile";
  return "jams";
}

export function DesignNotes({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const screen = screenFromPath(pathname);
  const notes = NOTES[screen] ?? NOTES.jams;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-t-[24px] border border-[#2a3140] p-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto"
        style={{
          background: "var(--ec-surface, #161b22)",
          borderColor: "var(--ec-border, #2a3140)",
        }}
      >
        <div className="flex items-center justify-between mb-[6px]">
          <div className="flex items-center gap-[9px]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ec-accent, #ff922b)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            </svg>
            <h2 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[19px] m-0" style={{ color: "var(--ec-text, #e6edf3)" }}>
              Criterio de diseño · {notes.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-[9px] border-none flex items-center justify-center cursor-pointer text-[15px]"
            style={{ background: "var(--ec-surface2, #1d2330)", color: "var(--ec-sub, #9aa7b5)" }}
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-[13px] mt-[16px]">
          {notes.list.map((note, i) => (
            <div key={i} className="flex gap-[12px]">
              <div
                className="w-[24px] h-[24px] rounded-[8px] flex items-center justify-center text-[12px] font-bold flex-shrink-0 font-[family-name:var(--font-space-grotesk)]"
                style={{
                  background: "var(--ec-chip-bg, rgba(92,124,250,.14))",
                  color: "var(--ec-primary, #5c7cfa)",
                }}
              >
                {i + 1}
              </div>
              <div className="text-[13.5px] leading-[1.5]" style={{ color: "var(--ec-sub, #c2ccd8)" }}>
                <b className="font-semibold" style={{ color: "var(--ec-text, #e6edf3)" }}>{note.head}</b> — {note.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
