import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "midnight" | "stage" | "daylight";

interface UIState {
  sidebarOpen: boolean;
  notesOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
  toggleNotes: () => void;
  setNotesOpen: (open: boolean) => void;
}

const THEME_ORDER: Theme[] = ["midnight", "stage", "daylight"];

const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("encore-theme");
      if (stored === "midnight" || stored === "stage" || stored === "daylight") return stored;
      if (stored === "dark") return "midnight";
      if (stored === "light") return "daylight";
      if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "midnight";
    } catch {
      // localStorage or matchMedia unavailable (e.g. test env)
    }
  }
  return "midnight";
};

const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      notesOpen: false,
      theme: getInitialTheme(),

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setTheme: (theme) => {
        localStorage.setItem("encore-theme", theme);
        set({ theme });
      },

      cycleTheme: () =>
        set((state) => {
          const idx = THEME_ORDER.indexOf(state.theme);
          const newTheme = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
          localStorage.setItem("encore-theme", newTheme);
          return { theme: newTheme };
        }),

      toggleNotes: () =>
        set((state) => ({ notesOpen: !state.notesOpen })),

      setNotesOpen: (open) => set({ notesOpen: open }),
    }),
    { name: "encore-ui" },
  ),
);

export { useUIStore };
