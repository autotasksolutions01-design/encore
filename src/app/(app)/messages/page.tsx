"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMessagesStore } from "@/lib/stores/messages";
import type { Conversation } from "@/lib/stores/messages";

interface ConversationData {
  id: string;
  participantA: string;
  participantB: string;
  lastMessageAt: string;
  otherParticipant: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    displayName: string;
    instruments: string[];
  };
  lastMessage: {
    text: string;
    createdAt: string;
    isOwn: boolean;
  } | null;
}

export default function MessagesPage() {
  const { t } = useTranslation("messages");
  const { t: tCommon } = useTranslation("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setStoreConversations = useMessagesStore(
    (s) => s.setConversations,
  );

  // If connectionId is passed, create a conversation and redirect
  const connectionParam = searchParams.get("conversation");

  useEffect(() => {
    if (connectionParam) {
      const createConversation = async () => {
        try {
          const res = await fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ connectionId: connectionParam }),
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error ?? "Failed to create conversation");
          }

          const data = await res.json();
          router.replace(`/es/messages/${data.conversationId}`);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create conversation",
          );
          setLoading(false);
        }
      };
      createConversation();
      return;
    }

    const fetchConversations = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to fetch conversations");
        const data = await res.json();
        setConversations(data.conversations);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load conversations",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [connectionParam]);

  if (loading && connectionParam) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-400">{tCommon("app.loading")}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-400">{tCommon("app.loading")}</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">{t("title")}</h1>

      {error && (
        <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            {tCommon("actions.close")}
          </button>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg">{t("noConversations")}</p>
          <p className="text-slate-500 text-sm mt-2">
            {t("startConversation")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/es/messages/${conv.id}`}
              className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg">
                {conv.otherParticipant.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-200 truncate">
                    {conv.otherParticipant.displayName}
                  </span>
                  <span className="text-slate-500 text-xs flex-shrink-0">
                    {new Date(conv.lastMessageAt).toLocaleDateString(
                      "es-AR",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </span>
                </div>
                <p className="text-slate-400 text-sm truncate mt-0.5">
                  {conv.otherParticipant.instruments.join(", ")}
                </p>
                {conv.lastMessage && (
                  <p className="text-slate-500 text-xs truncate mt-1">
                    {conv.lastMessage.isOwn ? "Vos: " : ""}
                    {conv.lastMessage.text}
                  </p>
                )}
              </div>
              <span className="text-slate-600 text-lg flex-shrink-0">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
