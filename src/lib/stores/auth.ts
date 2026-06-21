import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  onboardingCompleted: boolean;
  setAuth: (userId: string, onboardingCompleted: boolean) => void;
  clearAuth: () => void;
  setOnboardingCompleted: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      onboardingCompleted: false,

      setAuth: (userId, onboardingCompleted) =>
        set({
          isAuthenticated: true,
          userId,
          onboardingCompleted,
        }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          userId: null,
          onboardingCompleted: false,
        }),

      setOnboardingCompleted: () =>
        set({ onboardingCompleted: true }),
    }),
    { name: "encore-auth" },
  ),
);

export { useAuthStore };
