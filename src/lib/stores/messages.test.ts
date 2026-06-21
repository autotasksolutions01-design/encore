import { describe, it, expect, beforeEach } from "vitest";
import { useMessagesStore } from "./messages";

describe("useMessagesStore", () => {
  beforeEach(() => {
    const { clearMessages } = useMessagesStore.getState();
    clearMessages();
  });

  it("initializes empty", () => {
    const state = useMessagesStore.getState();
    expect(state.conversations).toEqual([]);
    expect(state.messagesByConversation).toEqual({});
    expect(state.activeConversationId).toBeNull();
  });

  it("sets conversations", () => {
    const { setConversations } = useMessagesStore.getState();
    setConversations([
      { id: "c1", participantA: "u1", participantB: "u2", lastMessageAt: "2024-01-01" },
    ]);
    expect(useMessagesStore.getState().conversations).toHaveLength(1);
  });

  it("sets active conversation", () => {
    const { setActiveConversation } = useMessagesStore.getState();
    setActiveConversation("c1");
    expect(useMessagesStore.getState().activeConversationId).toBe("c1");

    setActiveConversation(null);
    expect(useMessagesStore.getState().activeConversationId).toBeNull();
  });

  it("adds messages and deduplicates by ID", () => {
    const { addMessages, addMessage } = useMessagesStore.getState();
    addMessages("c1", [
      { id: "m1", conversationId: "c1", senderId: "u1", text: "Hola", isIntroTemplate: false, status: "sent", createdAt: "2024-01-01" },
    ]);
    addMessages("c1", [
      { id: "m1", conversationId: "c1", senderId: "u1", text: "Hola", isIntroTemplate: false, status: "sent", createdAt: "2024-01-01" },
      { id: "m2", conversationId: "c1", senderId: "u2", text: "Qué tal", isIntroTemplate: false, status: "sent", createdAt: "2024-01-02" },
    ]);

    const messages = useMessagesStore.getState().messagesByConversation["c1"];
    expect(messages).toHaveLength(2);
  });

  it("adds single message without duplicates", () => {
    const { addMessage } = useMessagesStore.getState();
    addMessage("c1", { id: "m1", conversationId: "c1", senderId: "u1", text: "Hi", isIntroTemplate: true, status: "sent", createdAt: "2024-01-01" });
    addMessage("c1", { id: "m1", conversationId: "c1", senderId: "u1", text: "Hi", isIntroTemplate: true, status: "sent", createdAt: "2024-01-01" });

    const messages = useMessagesStore.getState().messagesByConversation["c1"];
    expect(messages).toHaveLength(1);
  });

  it("sets poll timestamp", () => {
    const { setPollTimestamp } = useMessagesStore.getState();
    setPollTimestamp("c1", "2024-01-01T00:00:00Z");
    expect(useMessagesStore.getState().lastPollTimestamps["c1"]).toBe("2024-01-01T00:00:00Z");
  });
});
