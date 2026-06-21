"use client";

import { useState } from "react";
import type { JamResponseType } from "@prisma/client";

interface JamRespondButtonProps {
  jamId: string;
  currentResponse: JamResponseType | null;
}

/**
 * JamRespondButton — respond to a jam session: "interested" or "going".
 *
 * R36: Other musicians MUST be able to respond: "Interested" or "Going".
 * One response per user per jam. Changing response updates the existing one.
 */
export function JamRespondButton({
  jamId,
  currentResponse,
}: JamRespondButtonProps) {
  const [response, setResponse] = useState<JamResponseType | null>(
    currentResponse,
  );
  const [sending, setSending] = useState(false);

  const handleRespond = async (type: JamResponseType) => {
    if (sending) return;
    setSending(true);

    try {
      const res = await fetch(`/api/jams/${jamId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: type }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to respond:", data.error);
        return;
      }

      setResponse(type);
    } catch (err) {
      console.error("Failed to respond:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleRespond("interested")}
        disabled={sending}
        aria-pressed={response === "interested"}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          response === "interested"
            ? "bg-slate-600 text-white"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Me interesa"
      >
        Me interesa
      </button>
      <button
        onClick={() => handleRespond("going")}
        disabled={sending}
        aria-pressed={response === "going"}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          response === "going"
            ? "bg-brand-600 text-white"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label="Voy"
      >
        Voy
      </button>
    </div>
  );
}
