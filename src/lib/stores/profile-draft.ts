import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProfileInput } from "@/lib/validations/profile";

interface ProfileDraftState {
  draft: Partial<ProfileInput> | null;
  lastSaved: string | null;
  setDraft: (draft: Partial<ProfileInput>) => void;
  clearDraft: () => void;
  hasDraft: () => boolean;
}

const useProfileDraftStore = create<ProfileDraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      lastSaved: null,

      setDraft: (draft) =>
        set({
          draft,
          lastSaved: new Date().toISOString(),
        }),

      clearDraft: () =>
        set({
          draft: null,
          lastSaved: null,
        }),

      hasDraft: () => get().draft !== null,
    }),
    { name: "encore-profile-draft" },
  ),
);

export { useProfileDraftStore };
