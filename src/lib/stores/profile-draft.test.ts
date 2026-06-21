import { describe, it, expect, beforeEach } from "vitest";
import { useProfileDraftStore } from "./profile-draft";

describe("useProfileDraftStore", () => {
  beforeEach(() => {
    const { clearDraft } = useProfileDraftStore.getState();
    clearDraft();
  });

  it("initializes with null draft", () => {
    const state = useProfileDraftStore.getState();
    expect(state.draft).toBeNull();
    expect(state.lastSaved).toBeNull();
  });

  it("sets draft", () => {
    const { setDraft } = useProfileDraftStore.getState();
    setDraft({ displayName: "Juan", city: "Buenos Aires" });

    const state = useProfileDraftStore.getState();
    expect(state.draft).toEqual({ displayName: "Juan", city: "Buenos Aires" });
    expect(state.lastSaved).toBeTruthy();
  });

  it("clears draft", () => {
    const { setDraft, clearDraft } = useProfileDraftStore.getState();
    setDraft({ displayName: "Juan" });
    clearDraft();

    const state = useProfileDraftStore.getState();
    expect(state.draft).toBeNull();
    expect(state.lastSaved).toBeNull();
  });

  it("hasDraft returns true when draft exists", () => {
    const { setDraft, hasDraft } = useProfileDraftStore.getState();
    expect(hasDraft()).toBe(false);

    setDraft({ displayName: "Juan" });
    expect(hasDraft()).toBe(true);
  });
});
