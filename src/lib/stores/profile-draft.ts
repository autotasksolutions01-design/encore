import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProfileInput } from "@/lib/validations/profile";

type ProfileDraftData = Partial<ProfileInput> & {
  lookingFor?: { instrument?: string; genre?: string; role: string }[];
};

interface ProfileDraftState {
  draft: ProfileDraftData | null;
  lastSaved: string | null;
  setDraft: (draft: ProfileDraftData) => void;
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
export type { ProfileDraftData };
