import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/app/_components/SearchFilters", () => ({
  SearchFilters: () => null,
}));

vi.mock("@/app/_components/ProfileCard", () => ({
  ProfileCard: () => null,
}));

vi.mock("@/lib/discovery", () => ({
  discoverProfiles: vi.fn().mockResolvedValue({
    profiles: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
  }),
}));

import DiscoverPage from "../page";

describe("DiscoverPage welcome panel", () => {
  it("renders welcome panel when welcome=1", async () => {
    const jsx = await DiscoverPage({
      searchParams: Promise.resolve({ welcome: "1" }),
    });
    const { getByText } = render(jsx);

    expect(getByText("Tu perfil ya está listo 🎉")).toBeTruthy();
    expect(getByText("Buscar músicos")).toBeTruthy();
    expect(getByText("Editar mi perfil")).toBeTruthy();
  });

  it("does not render welcome panel when welcome is not set", async () => {
    const jsx = await DiscoverPage({
      searchParams: Promise.resolve({}),
    });
    const { queryByText } = render(jsx);

    expect(queryByText("Tu perfil ya está listo 🎉")).toBeNull();
  });

  it("does not render welcome panel when welcome is not 1", async () => {
    const jsx = await DiscoverPage({
      searchParams: Promise.resolve({ welcome: "0" }),
    });
    const { queryByText } = render(jsx);

    expect(queryByText("Tu perfil ya está listo 🎉")).toBeNull();
  });
});
