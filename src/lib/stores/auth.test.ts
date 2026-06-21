import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./auth";

describe("useAuthStore", () => {
  beforeEach(() => {
    const { clearAuth } = useAuthStore.getState();
    clearAuth();
  });

  it("initializes with no auth", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
    expect(state.onboardingCompleted).toBe(false);
  });

  it("sets auth state", () => {
    const { setAuth } = useAuthStore.getState();
    setAuth("user-1", false);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.userId).toBe("user-1");
    expect(state.onboardingCompleted).toBe(false);
  });

  it("clears auth state", () => {
    const { setAuth, clearAuth } = useAuthStore.getState();
    setAuth("user-1", true);
    clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
  });

  it("marks onboarding as completed", () => {
    const { setAuth, setOnboardingCompleted } = useAuthStore.getState();
    setAuth("user-1", false);
    setOnboardingCompleted();

    const state = useAuthStore.getState();
    expect(state.onboardingCompleted).toBe(true);
  });
});
