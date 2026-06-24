import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingWizard } from "../OnboardingWizard";

const mockPush = vi.fn();

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", email: "test@test.com" } },
    update: vi.fn().mockResolvedValue({}),
  }),
  signIn: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key.startsWith("skill.")) {
        const lvl = key.split(".")[1];
        return lvl.charAt(0).toUpperCase() + lvl.slice(1);
      }
      if (key.startsWith("role.")) {
        const role = key.split(".")[1];
        return role.charAt(0).toUpperCase() + role.slice(1);
      }
      if (key === "onboarding.step") {
        return `Step ${options?.current} of ${options?.total}`;
      }
      if (key === "app.loading") return "Loading...";
      if (key === "onboarding.displayName") return "Display name";
      if (key === "onboarding.instruments") return "Instruments";
      if (key === "onboarding.genres") return "Genres";
      if (key === "onboarding.skillLevel") return "Skill level";
      if (key === "onboarding.city") return "City";
      if (key === "onboarding.bio") return "Bio";
      if (key === "onboarding.lookingFor") return "Looking for";
      if (key === "onboarding.back") return "Back";
      if (key === "onboarding.next") return "Next";
      if (key === "onboarding.finish") return "Finish";
      if (key === "onboarding.publishing") return "Publishing...";
      if (key === "onboarding.success") return "Profile created!";
      return key;
    },
  }),
}));

// Mock Zustand stores
const mockSetOnboardingCompleted = vi.fn();
const mockSetDraft = vi.fn();
const mockClearDraft = vi.fn();

vi.mock("@/lib/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/lib/stores/profile-draft", () => ({
  useProfileDraftStore: vi.fn(),
}));

import { useAuthStore } from "@/lib/stores/auth";
import { useProfileDraftStore } from "@/lib/stores/profile-draft";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function nextButton() {
  return screen.getByRole("button", { name: /Next/ });
}

function backButton() {
  return screen.getByRole("button", { name: /Back/ });
}

function finishButton() {
  return screen.getByRole("button", { name: /Finish/ });
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: { id: "profile-1" } }),
    });
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      userId: "user-1",
      onboardingCompleted: false,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
      setOnboardingCompleted: mockSetOnboardingCompleted,
    });
    vi.mocked(useProfileDraftStore).mockReturnValue({
      draft: null,
      lastSaved: null,
      setDraft: mockSetDraft,
      clearDraft: mockClearDraft,
      hasDraft: () => false,
    });
  });

  it("renders first step with step indicator", () => {
    render(<OnboardingWizard userId="user-1" />);
    expect(screen.getByText("Step 1 of 7")).toBeTruthy();
  });

  it("has display name input on step 0", () => {
    render(<OnboardingWizard userId="user-1" />);
    expect(screen.getByPlaceholderText("Tu nombre artístico")).toBeTruthy();
  });

  it("shows error when Next clicked with empty displayName", () => {
    render(<OnboardingWizard userId="user-1" />);
    fireEvent.click(nextButton());
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("advances to instruments step after valid displayName", async () => {
    render(<OnboardingWizard userId="user-1" />);

    fireEvent.change(screen.getByPlaceholderText("Tu nombre artístico"), {
      target: { value: "Juan Guitar" },
    });
    fireEvent.click(nextButton());

    await waitFor(() => {
      // "Instruments" appears twice (step label + form label)
      const elements = screen.getAllByText("Instruments");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for missing instruments", async () => {
    render(<OnboardingWizard userId="user-1" />);

    fireEvent.change(screen.getByPlaceholderText("Tu nombre artístico"), {
      target: { value: "Juan" },
    });
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Instruments").length).toBeGreaterThan(0);
    });
    fireEvent.click(nextButton());

    expect(
      screen.getByText("At least one instrument is required"),
    ).toBeTruthy();
  });

  it("navigates back from instruments to displayName", async () => {
    render(<OnboardingWizard userId="user-1" />);

    fireEvent.change(screen.getByPlaceholderText("Tu nombre artístico"), {
      target: { value: "Juan" },
    });
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Instruments").length).toBeGreaterThan(0);
    });
    fireEvent.click(backButton());

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Tu nombre artístico")).toBeTruthy();
    });
  });

  it("shows Finish button on last step", async () => {
    render(<OnboardingWizard userId="user-1" />);

    fireEvent.change(screen.getByPlaceholderText("Tu nombre artístico"), {
      target: { value: "Juan" },
    });
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Instruments").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("guitar"));
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Genres").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("rock"));
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Skill level").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("Advanced"));
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("City").length).toBeGreaterThan(0);
    });
    fireEvent.change(
      screen.getByPlaceholderText("Buenos Aires, Argentina"),
      { target: { value: "Buenos Aires" } },
    );
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Bio").length).toBeGreaterThan(0);
    });
    fireEvent.click(nextButton());

    await waitFor(() => {
      expect(screen.getAllByText("Looking for").length).toBeGreaterThan(0);
    });
    expect(finishButton()).toBeTruthy();
  });

  it("calls API on finish with valid data", async () => {
    render(<OnboardingWizard userId="user-1" />);

    fireEvent.change(screen.getByPlaceholderText("Tu nombre artístico"), {
      target: { value: "Juan Guitar" },
    });
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("Instruments").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("guitar"));
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("Genres").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("rock"));
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("Skill level").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByText("Advanced"));
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("City").length).toBeGreaterThan(0);
    });
    fireEvent.change(
      screen.getByPlaceholderText("Buenos Aires, Argentina"),
      { target: { value: "Buenos Aires" } },
    );
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("Bio").length).toBeGreaterThan(0);
    });
    fireEvent.click(nextButton());
    await waitFor(() => {
      expect(screen.getAllByText("Looking for").length).toBeGreaterThan(0);
    });

    fireEvent.click(finishButton());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith("/es/discover?welcome=1");
      },
      { timeout: 3000 },
    );
  });
});
