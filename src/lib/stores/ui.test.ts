import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui";

describe("useUIStore", () => {
  beforeEach(() => {
    const { setSidebarOpen, setTheme } = useUIStore.getState();
    setSidebarOpen(true);
    setTheme("dark");
  });

  it("initializes with sidebar open and dark theme", () => {
    const state = useUIStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.theme).toBe("dark");
  });

  it("toggles sidebar", () => {
    const { toggleSidebar } = useUIStore.getState();
    toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("sets sidebar open", () => {
    const { setSidebarOpen } = useUIStore.getState();
    setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("sets theme", () => {
    const { setTheme } = useUIStore.getState();
    setTheme("light");
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("toggles theme", () => {
    const { toggleTheme } = useUIStore.getState();
    toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");

    toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });
});
