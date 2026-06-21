import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to avoid the hoisting issue with vi.mock factories
const { mockQueryRaw, mockFindMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRaw,
    profileInstrument: { findMany: mockFindMany },
    profileGenre: { findMany: mockFindMany },
  },
}));

import { discoverProfiles } from "../discovery";

describe("discoverProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProfiles = [
    {
      id: "profile-1",
      displayName: "Juan Guitar",
      bio: "Guitarrista",
      skillLevel: "advanced",
      city: "Buenos Aires",
      lat: -34.6037,
      lng: -58.3816,
      avatarKey: null,
      avatarUrl: null,
      name: "Juan",
      publishedAt: new Date(),
    },
    {
      id: "profile-2",
      displayName: "Maria Bass",
      bio: "Bajista",
      skillLevel: "intermediate",
      city: "Buenos Aires",
      lat: -34.61,
      lng: -58.38,
      avatarKey: null,
      avatarUrl: null,
      name: "Maria",
      publishedAt: new Date(),
    },
  ];

  const mockInstruments = [
    { profileId: "profile-1", instrument: "guitar" },
    { profileId: "profile-1", instrument: "bass" },
    { profileId: "profile-2", instrument: "bass" },
  ];

  const mockGenres = [
    { profileId: "profile-1", genre: "rock" },
    { profileId: "profile-1", genre: "blues" },
    { profileId: "profile-2", genre: "rock" },
  ];

  it("returns public published profiles with pagination", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 2 }]); // count
    mockQueryRaw.mockResolvedValueOnce(mockProfiles); // data
    mockFindMany
      .mockResolvedValueOnce(mockInstruments)
      .mockResolvedValueOnce(mockGenres);

    const result = await discoverProfiles({});

    expect(result.total).toBe(2);
    expect(result.profiles).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.hasMore).toBe(false);

    expect(result.profiles[0].instruments).toContain("guitar");
    expect(result.profiles[0].genres).toContain("rock");
  });

  it("filters by instrument", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1 }]);
    mockQueryRaw.mockResolvedValueOnce([mockProfiles[0]]);
    mockFindMany
      .mockResolvedValueOnce([mockInstruments[0]])
      .mockResolvedValueOnce(mockGenres.slice(0, 2));

    const result = await discoverProfiles({ instrument: "guitar" });

    expect(result.total).toBe(1);
    expect(result.profiles).toHaveLength(1);
  });

  it("filters by genre", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 2 }]);
    mockQueryRaw.mockResolvedValueOnce(mockProfiles);
    mockFindMany
      .mockResolvedValueOnce(mockInstruments)
      .mockResolvedValueOnce(mockGenres);

    const result = await discoverProfiles({ genre: "rock" });

    expect(result.total).toBe(2);
    expect(result.profiles).toHaveLength(2);
  });

  it("filters by skill level", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1 }]);
    mockQueryRaw.mockResolvedValueOnce([mockProfiles[0]]);
    mockFindMany
      .mockResolvedValueOnce([mockInstruments[0], mockInstruments[1]])
      .mockResolvedValueOnce(mockGenres.slice(0, 2));

    const result = await discoverProfiles({ skillLevel: "advanced" });

    expect(result.total).toBe(1);
    expect(result.profiles[0].skillLevel).toBe("advanced");
  });

  it("applies spatial filter when lat/lng provided", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1 }]);
    mockQueryRaw.mockResolvedValueOnce([mockProfiles[0]]);
    mockFindMany
      .mockResolvedValueOnce([mockInstruments[0], mockInstruments[1]])
      .mockResolvedValueOnce(mockGenres.slice(0, 2));

    const result = await discoverProfiles({
      lat: -34.6037,
      lng: -58.3816,
      radiusKm: 10,
    });

    expect(result.total).toBe(1);
    expect(result.profiles).toHaveLength(1);
  });

  it("caps radius at 500km", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1 }]);
    mockQueryRaw.mockResolvedValueOnce([mockProfiles[0]]);
    mockFindMany
      .mockResolvedValueOnce([mockInstruments[0]])
      .mockResolvedValueOnce(mockGenres.slice(0, 1));

    const result = await discoverProfiles({
      lat: -34.6037,
      lng: -58.3816,
      radiusKm: 1000,
    });

    expect(result.total).toBe(1);
  });

  it("returns empty result when no matches", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 0 }]);

    const result = await discoverProfiles({
      instrument: "theremin",
      genre: "gregorian",
    });

    expect(result.total).toBe(0);
    expect(result.profiles).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("calculates hasMore correctly", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 22 }]);
    mockQueryRaw.mockResolvedValueOnce(mockProfiles);
    mockFindMany
      .mockResolvedValueOnce(mockInstruments)
      .mockResolvedValueOnce(mockGenres);

    const result = await discoverProfiles({ page: 1 });

    expect(result.total).toBe(22);
    expect(result.hasMore).toBe(true);
  });

  it("defaults page to 1 when invalid", async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 2 }]);
    mockQueryRaw.mockResolvedValueOnce(mockProfiles);
    mockFindMany
      .mockResolvedValueOnce(mockInstruments)
      .mockResolvedValueOnce(mockGenres);

    const result = await discoverProfiles({ page: -1 });

    expect(result.page).toBe(1);
  });
});
