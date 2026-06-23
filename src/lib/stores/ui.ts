import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface UIState {
  sidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("encore-theme");
      if (stored === "dark" || stored === "light") return stored;
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    } catch {
      // localStorage or matchMedia unavailable (e.g. test env)
    }
  }
  return "dark";
};

const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: getInitialTheme(),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setTheme: (theme) => {
        localStorage.setItem("encore-theme", theme);
        set({ theme });
      },

      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === "dark" ? "light" : "dark";
          localStorage.setItem("encore-theme", newTheme);
          return { theme: newTheme };
        }),
    }),
    { name: "encore-ui" },
  ),
);

export { useUIStore };
export type { Theme };
