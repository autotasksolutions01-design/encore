"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface ConnectionData {
  id: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  requester: {
    id: string;
    displayName: string;
    city: string;
    skillLevel: string;
    instruments: string[];
    genres: string[];
  };
  receiver: {
    id: string;
    displayName: string;
    city: string;
    skillLevel: string;
    instruments: string[];
    genres: string[];
  };
}

export default function ConnectionsPage() {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<"pending" | "accepted">("pending");
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConnections = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/connections?status=${activeTab}`);
        if (!res.ok) {
          throw new Error("Failed to fetch connections");
        }
        const data = await res.json();
        setConnections(data.connections);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load connections",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [activeTab]);

  const handleRespond = async (id: string, action: "accept" | "decline") => {
    try {
      const res = await fetch(`/api/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to respond");
      }

      // Remove from the list
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to respond",
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-400">{t("app.loading")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">
        {t("nav.connections")}
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]",
            activeTab === "pending"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
        >
          Pendientes
        </button>
        <button
          onClick={() => setActiveTab("accepted")}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px]",
            activeTab === "accepted"
              ? "border-brand-500 text-brand-400"
              : "border-transparent text-slate-400 hover:text-slate-300",
          )}
        >
          Conectados
        </button>
      </div>

      {error && (
        <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            {t("actions.close")}
          </button>
        </div>
      )}

      {connections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">
            {activeTab === "pending"
              ? "No tenés solicitudes pendientes"
              : "No tenés conexiones todavía"}
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {activeTab === "pending"
              ? "Cuando alguien muestre interés, va a aparecer acá."
              : "Aceptá solicitudes o explorá músicos para conectar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => {
            const isRequester =
              conn.requester.id ===
              connections.find((c) => c.requester.id === conn.requester.id)
                ?.requester.id;
            const otherProfile = activeTab === "pending"
              ? conn.requester
              : conn.status === "pending" ? conn.requester : conn.receiver;

            return (
              <div
                key={conn.id}
                className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg">
                  {otherProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/es/profile/${otherProfile.id}`}
                    className="font-medium text-slate-200 hover:text-brand-400 transition-colors"
                  >
                    {otherProfile.displayName}
                  </Link>
                  <p className="text-slate-400 text-sm truncate">
                    {otherProfile.instruments.join(", ")}
                    {otherProfile.city ? ` · ${otherProfile.city}` : ""}
                  </p>
                  {conn.status === "accepted" && (
                    <Link
                      href={`/es/messages?conversation=${conn.id}`}
                      className="text-brand-400 text-sm hover:underline mt-1 inline-block"
                    >
                      Enviar mensaje →
                    </Link>
                  )}
                </div>
                {activeTab === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRespond(conn.id, "accept")}
                      className="px-3 py-1.5 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleRespond(conn.id, "decline")}
                      className="px-3 py-1.5 text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
