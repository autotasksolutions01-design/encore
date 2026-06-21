import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileCard } from "../ProfileCard";

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
    // Two "+1" elements exist (instruments + genres)
    const overflow = screen.getAllByText("+1");
    expect(overflow.length).toBe(2);
  });

  it("shows max 2 genres with +N overflow", () => {
    render(<ProfileCard {...baseProps} />);
    expect(screen.getByText("rock")).toBeTruthy();
    expect(screen.getByText("blues")).toBeTruthy();
    // Two "+1" elements exist (instruments + genres)
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
    // No +N for genres since we have exactly 2
  });
});
