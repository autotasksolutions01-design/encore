import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  isIntroTemplate: boolean;
  status: "sent" | "delivered" | "read";
  createdAt: string;
}

interface Conversation {
  id: string;
  participantA: string;
  participantB: string;
  lastMessageAt: string;
}

interface MessagesState {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  activeConversationId: string | null;
  lastPollTimestamps: Record<string, string>;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversationId: string | null) => void;
  addMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  setPollTimestamp: (conversationId: string, timestamp: string) => void;
  clearMessages: () => void;
}

const useMessagesStore = create<MessagesState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messagesByConversation: {},
      activeConversationId: null,
      lastPollTimestamps: {},

      setConversations: (conversations) => set({ conversations }),

      setActiveConversation: (conversationId) =>
        set({ activeConversationId: conversationId }),

      addMessages: (conversationId, newMessages) =>
        set((state) => {
          const existing = state.messagesByConversation[conversationId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const unique = newMessages.filter((m) => !existingIds.has(m.id));
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: [...existing, ...unique],
            },
          };
        }),

      addMessage: (conversationId, message) =>
        set((state) => {
          const existing = state.messagesByConversation[conversationId] || [];
          if (existing.some((m) => m.id === message.id)) return state;
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: [...existing, message],
            },
          };
        }),

      setPollTimestamp: (conversationId, timestamp) =>
        set((state) => ({
          lastPollTimestamps: {
            ...state.lastPollTimestamps,
            [conversationId]: timestamp,
          },
        })),

      clearMessages: () =>
        set({
          conversations: [],
          messagesByConversation: {},
          activeConversationId: null,
          lastPollTimestamps: {},
        }),
    }),
    {
      name: "encore-messages",
      partialize: (state) => ({
        conversations: state.conversations,
        messagesByConversation: state.messagesByConversation,
      }),
    },
  ),
);

export { useMessagesStore };
export type { Message, Conversation };
