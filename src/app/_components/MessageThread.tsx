"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useMessagesStore } from "@/lib/stores/messages";
import type { Message as MessageType } from "@/lib/stores/messages";

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  introTemplate?: string;
}

export function MessageThread({
  conversationId,
  currentUserId,
  introTemplate,
}: MessageThreadProps) {
  const { t } = useTranslation("messages");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [introText, setIntroText] = useState<string | null>(
    introTemplate ?? null,
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasSentFirst = useRef(false);

  const messages = useMessagesStore((s) => s.messagesByConversation[conversationId] ?? []);
  const addMessages = useMessagesStore((s) => s.addMessages);
  const addMessage = useMessagesStore((s) => s.addMessage);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Pre-fill intro template on first render if no messages exist
  useEffect(() => {
    if (introTemplate && messages.length === 0 && !hasSentFirst.current) {
      setText(introTemplate);
    }
  }, [introTemplate, messages.length]);

  // 5-second polling for new messages (R33)
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      try {
        const lastMsg = messages[messages.length - 1];
        const sinceParam = lastMsg
          ? `&since=${lastMsg.createdAt}`
          : "";

        const res = await fetch(
          `/api/messages?conversationId=${conversationId}${sinceParam}`,
        );

        if (res.status === 304) {
          // No new messages, continue polling
          return;
        }

        if (!res.ok) return;

        const data = await res.json();
        if (isMounted && data.messages?.length > 0) {
          addMessages(conversationId, data.messages);
        }
      } catch {
        // Silently fail on poll errors — retry next cycle
      }
    };

    // Initial fetch for conversation messages
    const initialFetch = async () => {
      try {
        const res = await fetch(
          `/api/messages?conversationId=${conversationId}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) {
            addMessages(conversationId, data.messages);
            hasSentFirst.current = true;
          }
        }
      } catch {
        // Silently fail
      }
    };

    initialFetch();
    const interval = setInterval(poll, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          text: trimmed,
          isIntroTemplate: introText !== null && !hasSentFirst.current,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }

      const data = await res.json();
      addMessage(conversationId, data.message);
      setText("");
      hasSentFirst.current = true;
      setIntroText(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !introTemplate && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">
              No hay mensajes todavía. ¡Decí hola!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === currentUserId}
            t={t}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Introtemplate label */}
      {introText && messages.length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-brand-400 flex items-center gap-1">
            <span>✨</span>
            {t("introTemplate", {
              displayName: "",
              instruments: "",
              genres: "",
            }).split("{{")[0]}
            <span className="italic">— editable</span>
          </p>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-slate-800 px-4 py-3 bg-slate-900">
        {error && (
          <div className="mb-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              {t("close", "Cerrar")}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            rows={2}
            className="flex-1 bg-slate-800 text-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-slate-500"
            maxLength={1000}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors self-end",
              text.trim() && !sending
                ? "bg-brand-600 hover:bg-brand-500 text-white"
                : "bg-slate-800 text-slate-600 cursor-not-allowed",
            )}
          >
            {sending ? "..." : t("send", "Enviar")}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  t,
}: {
  message: MessageType;
  isOwn: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={cn("flex", isOwn ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
          isOwn
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-slate-800 text-slate-200 rounded-bl-md",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1 text-xs",
            isOwn ? "text-brand-300" : "text-slate-500",
          )}
        >
          <span>{formattedTime}</span>
          {isOwn && (
            <StatusIcon status={message.status} t={t} />
          )}
          {message.isIntroTemplate && (
            <span className="text-[10px] opacity-60 ml-1">
              ✨ intro
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({
  status,
  t,
}: {
  status: string;
  t: (key: string, fallback?: string) => string;
}) {
  switch (status) {
    case "sent":
      return <span title={t("status.sent")}>✓</span>;
    case "delivered":
      return (
        <span title={t("status.delivered")} className="text-blue-300">
          ✓✓
        </span>
      );
    case "read":
      return (
        <span title={t("status.read")} className="text-green-300">
          ✓✓
        </span>
      );
    default:
      return null;
  }
}
