"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { MessageThread } from "@/app/_components/MessageThread";
import { useMessagesStore } from "@/lib/stores/messages";

interface ConversationData {
  id: string;
  otherParticipant: {
    id: string;
    displayName: string;
    instruments: string[];
  };
}

export default function MessageThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t: tCommon } = useTranslation("common");
  const [conversation, setConversation] = useState<ConversationData | null>(
    null,
  );
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [introTemplate, setIntroTemplate] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveConversation = useMessagesStore(
    (s) => s.setActiveConversation,
  );

  useEffect(() => {
    const conversationId = params.id;

    if (!conversationId) {
      setError("No conversation ID");
      setLoading(false);
      return;
    }

    setActiveConversation(conversationId);

    const fetchConversation = async () => {
      try {
        // Get conversation details (participants, etc.)
        const res = await fetch("/api/conversations");
        if (!res.ok) throw new Error("Failed to load conversation");

        const data = await res.json();
        const conv = data.conversations.find(
          (c: { id: string }) => c.id === conversationId,
        );

        if (!conv) {
          setError("Conversation not found");
          setLoading(false);
          return;
        }

        setConversation(conv);

        // Get the current user session
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          const userId = sessionData?.user?.id;
          if (userId) {
            setCurrentUserId(userId);
          }
        }

        // Create conversation to get introTemplate
        try {
          // Try to find the connection for this conversation
          const conversationsRes = await fetch("/api/conversations");
          if (conversationsRes.ok) {
            const allData = await conversationsRes.json();
            const convData = allData.conversations.find(
              (c: { id: string }) => c.id === conversationId,
            );

            // If this is a fresh conversation (no messages), fetch intro template
            // by POSTing to /api/conversations with the first connection found
            if (convData && !convData.lastMessage) {
              // For existing conversations, we can't easily get the connection ID
              // from the conversation alone. Use a simpler approach:
              // Check if there are no messages yet, then the intro template
              // would have been provided when creating the conversation.
              // We'll let the MessageThread component handle this via its introTemplate prop.
            }
          }
        } catch {
          // Non-critical: intro template is optional
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load conversation",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-slate-400">{tCommon("app.loading")}</div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-red-400 text-lg">
          {error ?? "Conversation not found"}
        </p>
        <button
          onClick={() => router.push("/es/messages")}
          className="mt-4 text-brand-400 hover:underline text-sm"
        >
          ← {tCommon("actions.back")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => router.push("/es/messages")}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Back to conversations"
        >
          ←
        </button>
        <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-sm">
          {conversation.otherParticipant.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="font-medium text-slate-200 text-sm">
            {conversation.otherParticipant.displayName}
          </h2>
          {conversation.otherParticipant.instruments.length > 0 && (
            <p className="text-slate-500 text-xs">
              {conversation.otherParticipant.instruments.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 min-h-0">
        <MessageThread
          conversationId={params.id}
          currentUserId={currentUserId}
          introTemplate={introTemplate}
        />
      </div>
    </div>
  );
}
