import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui";

describe("useUIStore", () => {
  beforeEach(() => {
    const { setSidebarOpen, setTheme } = useUIStore.getState();
    setSidebarOpen(true);
    setTheme("midnight");
  });

  it("initializes with sidebar open and midnight theme", () => {
    const state = useUIStore.getState();
    expect(state.sidebarOpen).toBe(true);
    expect(state.theme).toBe("midnight");
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
    setTheme("stage");
    expect(useUIStore.getState().theme).toBe("stage");
  });

  it("cycles theme", () => {
    const { cycleTheme } = useUIStore.getState();

    cycleTheme();
    expect(useUIStore.getState().theme).toBe("stage");

    cycleTheme();
    expect(useUIStore.getState().theme).toBe("daylight");

    cycleTheme();
    expect(useUIStore.getState().theme).toBe("midnight");
  });
});
