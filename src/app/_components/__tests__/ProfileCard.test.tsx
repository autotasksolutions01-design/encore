import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileCard } from "../ProfileCard";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const mockHowl = vi.fn();
const mockHowlInstance = {
  play: vi.fn(),
  pause: vi.fn(),
  playing: vi.fn().mockReturnValue(false),
  duration: vi.fn().mockReturnValue(30),
  seek: vi.fn().mockReturnValue(0),
  unload: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

mockHowl.mockImplementation(() => mockHowlInstance);

vi.mock("howler", () => ({
  Howl: mockHowl,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockHowl.mockImplementation(() => mockHowlInstance);
});

describe("ProfileCard", () => {
  const baseProps = {
    id: "profile-1",
    displayName: "Juan Guitar",
    instruments: ["guitar", "bass", "drums", "piano"],
    genres: ["rock", "blues", "funk"],
    skillLevel: "advanced",
    city: "Buenos Aires",
    avatarUrl: null,
  };

  it("renders display name", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("Juan Guitar")).toBeTruthy();
  });

  it("renders city", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("Buenos Aires")).toBeTruthy();
  });

  it("shows max 3 instruments with +N overflow", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("guitar")).toBeTruthy();
    expect(screen.getByText("bass")).toBeTruthy();
    expect(screen.getByText("drums")).toBeTruthy();
    const overflow = screen.getAllByText("+1");
    expect(overflow.length).toBe(2);
  });

  it("shows max 2 genres with +N overflow", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("rock")).toBeTruthy();
    expect(screen.getByText("blues")).toBeTruthy();
    const overflow = screen.getAllByText("+1");
    expect(overflow.length).toBe(2);
  });

  it("renders skill badge", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("Avanzado")).toBeTruthy();
  });

  it("renders skill badge for beginner", () => {
    render(<ProfileCard {...baseProps} skillLevel="beginner" />);
    expect(screen.getByText("Principiante")).toBeTruthy();
  });

  it("renders skill badge for pro", () => {
    render(<ProfileCard {...baseProps} skillLevel="pro" />);
    expect(screen.getByText("Pro")).toBeTruthy();
  });

  it("renders avatar placeholder when no avatarUrl", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("J")).toBeTruthy();
  });

  it("links to profile page", () => {
    render(<ProfileCard {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/es/profile/profile-1");
  });

  it("shows no overflow when instruments <= 3", () => {
    render(
      <ProfileCard
        {...baseProps}
        instruments={["guitar", "bass"]}
        genres={["rock"]}
      />,
    );
    expect(screen.getByText("guitar")).toBeTruthy();
    expect(screen.getByText("bass")).toBeTruthy();
    expect(screen.queryByText("+1")).toBeFalsy();
  });

  it("shows no overflow when genres <= 2", () => {
    render(
      <ProfileCard
        {...baseProps}
        instruments={["guitar"]}
        genres={["rock", "blues"]}
      />,
    );
    expect(screen.getByText("rock")).toBeTruthy();
    expect(screen.getByText("blues")).toBeTruthy();
  });

  it("shows distance when provided", () => {
    render(<ProfileCard {...baseProps} distanceKm={12.34} />);
    expect(screen.getByText("12.3 km")).toBeTruthy();
  });

  it("does not render km text when distanceKm is undefined", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it("rounds 0.05 to 0.1 km", () => {
    render(<ProfileCard {...baseProps} distanceKm={0.05} />);
    expect(screen.getByText("0.1 km")).toBeTruthy();
  });

  it("rounds 9.99 to 10.0 km", () => {
    render(<ProfileCard {...baseProps} distanceKm={9.99} />);
    expect(screen.getByText("10.0 km")).toBeTruthy();
  });

  it("renders connect button with Conectar text", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("Conectar")).toBeTruthy();
  });

  it("changes connect button text on click", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ connection: { id: "conn-1", status: "pending" } }),
    });
    globalThis.fetch = mockFetch;

    render(<ProfileCard {...baseProps} />);
    const btn = screen.getByText("Conectar");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Enviado ✓")).toBeTruthy();
    });
  });

  it("does not render audio preview when no audioClips", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.queryByRole("button", { name: /reproducir|pausar/i })).toBeNull();
  });

  it("renders audio preview when audioClips provided", () => {
    render(
      <ProfileCard
        {...baseProps}
        audioClips={[
          {
            id: "clip-1",
            title: "Mi demo",
            audioUrl: "https://example.com/audio.mp3",
            waveformData: [0.1, 0.5, 0.8, 0.3],
            duration: 30,
          },
        ]}
      />,
    );
    const playBtn = screen.getByRole("button", { name: /reproducir/i });
    expect(playBtn).toBeTruthy();
  });
});
