import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
const prismaMock = {
  profile: {
    findUnique: vi.fn(),
  },
  connection: {
    findMany: vi.fn(),
  },
  block: {
    findMany: vi.fn(),
  },
  profileInstrument: {
    findMany: vi.fn(),
  },
  profileGenre: {
    findMany: vi.fn(),
  },
  $queryRawUnsafe: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const { getSuggestions } = await import("../suggestions");

describe("getSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProfile = {
    id: "profile-1",
    userId: "user-1",
    lat: -34.6037,
    lng: -58.3816,
    instruments: [
      { instrument: "guitar" },
      { instrument: "voice" },
    ],
    genres: [{ genre: "rock" }, { genre: "blues" }],
  };

  const mockCandidateProfile = {
    id: "profile-2",
    displayName: "Bass Player",
    bio: "Bassist looking for band",
    skillLevel: "advanced",
    city: "Buenos Aires",
    lat: -34.61,
    lng: -58.39,
    avatarKey: null,
    avatarUrl: null,
    name: "Bass Player",
    publishedAt: new Date(),
    distance_m: 2500,
  };

  it("returns empty if no profiles match in the spatial area", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([]);
    prismaMock.block.findMany.mockResolvedValue([]);
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns empty when profile not found", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(null);

    const result = await getSuggestions("profile-nonexistent", "user-1");
    expect(result.suggestions).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("finds complementary bass players for guitarists", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([]);
    prismaMock.block.findMany.mockResolvedValue([]);
    prismaMock.$queryRawUnsafe.mockResolvedValue([mockCandidateProfile]);
    prismaMock.profileInstrument.findMany.mockResolvedValue([
      { profileId: "profile-2", instrument: "bass" },
      { profileId: "profile-2", instrument: "drums" },
    ]);
    prismaMock.profileGenre.findMany.mockResolvedValue([
      { profileId: "profile-2", genre: "rock" },
      { profileId: "profile-2", genre: "funk" },
    ]);

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].instruments).toContain("bass");
    expect(result.suggestions[0].matchedOn.instruments).toContain("bass");
    expect(result.suggestions[0].matchedOn.genres).toContain("rock");
  });

  it("excludes already connected profiles", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([
      { requesterId: "profile-1", receiverId: "profile-2" },
    ]);
    prismaMock.block.findMany.mockResolvedValue([]);
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions).toEqual([]);
  });

  it("excludes blocked profiles", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([]);
    prismaMock.block.findMany.mockResolvedValue([
      { userId: "user-1", blockedUserId: "user-2" },
    ]);
    prismaMock.$queryRawUnsafe.mockResolvedValue([]);

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions).toEqual([]);
  });

  it("scores suggestions by complementary + genre + distance", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([]);
    prismaMock.block.findMany.mockResolvedValue([]);
    prismaMock.$queryRawUnsafe.mockResolvedValue([
      { ...mockCandidateProfile, distance_m: 1000, id: "profile-2" },
      { ...mockCandidateProfile, distance_m: 5000, id: "profile-3" },
    ]);
    prismaMock.profileInstrument.findMany.mockResolvedValue([
      { profileId: "profile-2", instrument: "bass" },
      { profileId: "profile-3", instrument: "bass" },
    ]);
    prismaMock.profileGenre.findMany.mockResolvedValue([
      { profileId: "profile-2", genre: "rock" },
      { profileId: "profile-3", genre: "rock" },
    ]);

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions).toHaveLength(2);
    // Profile 2 (1000m) should score higher than profile 3 (5000m)
    expect(result.suggestions[0].score).toBeGreaterThan(
      result.suggestions[1].score,
    );
  });

  it("respects max 20 suggestions limit", async () => {
    prismaMock.profile.findUnique.mockResolvedValue(mockProfile);
    prismaMock.connection.findMany.mockResolvedValue([]);
    prismaMock.block.findMany.mockResolvedValue([]);

    const manyProfiles = Array.from({ length: 30 }, (_, i) => ({
      ...mockCandidateProfile,
      id: `profile-${i + 2}`,
      distance_m: (i + 1) * 1000,
    }));
    prismaMock.$queryRawUnsafe.mockResolvedValue(manyProfiles);

    const manyInstruments = manyProfiles.map((p) => ({
      profileId: p.id,
      instrument: "bass",
    }));
    prismaMock.profileInstrument.findMany.mockResolvedValue(manyInstruments);
    prismaMock.profileGenre.findMany.mockResolvedValue(
      manyProfiles.map((p) => ({
        profileId: p.id,
        genre: "rock",
      })),
    );

    const result = await getSuggestions("profile-1", "user-1");
    expect(result.suggestions.length).toBeLessThanOrEqual(20);
  });
});
