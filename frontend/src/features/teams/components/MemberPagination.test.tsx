import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { authStorage } from "@/features/auth/utils/authStorage";
import { getTeamMembers } from "../api/teamMemberApi";
import MembersView from "./MembersView";
const viewer = {
  id: "viewer",
  firstName: "Viewer",
  lastName: "Person",
  email: "viewer@example.test",
  role: "USER",
};
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: viewer }),
}));
vi.mock("../api/teamApi", () => ({
  getTeamMe: vi.fn(async () => ({ userId: "viewer", role: "MEMBER" })),
}));
vi.mock("../api/teamMemberApi", () => ({ getTeamMembers: vi.fn() }));
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
let client: QueryClient;
beforeEach(() => {
  const encode = (value: unknown) => btoa(JSON.stringify(value));
  authStorage.setToken(
    `${encode({ alg: "HS256" })}.${encode({ sub: viewer.email, role: viewer.role, exp: 9999999999 })}.mock`,
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  vi.mocked(getTeamMembers).mockImplementation(async (_team, params) => {
    const page = params.page ?? 0,
      size = params.size ?? 10;
    return {
      content: Array.from({ length: size }, (_, i) => ({
        ...viewer,
        id: `member-${page * size + i}`,
        firstName: `Member ${page * size + i}`,
        teamRole: "MEMBER" as const,
        joinedAt: "2026-11-05T00:00:00Z",
      })),
      page,
      size,
      totalElements: 60,
      totalPages: Math.ceil(60 / size),
      last: (page + 1) * size >= 60,
    };
  });
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
  vi.clearAllMocks();
});
describe("member page-size flow", () => {
  it("requests the chosen size, resets the page and renders the matching number of members", async () => {
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/teams/TEAM/members"]}>
          <Routes>
            <Route
              path="/teams/:teamKey"
              element={
                <Outlet context={{ team: { key: "TEAM", deletedAt: null } }} />
              }
            >
              <Route path="members" element={<MembersView />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const table = await screen.findByRole("table");
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(11),
    );
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(vi.mocked(getTeamMembers).mock.calls.at(-1)?.[1]).toMatchObject({
        page: 1,
        size: 10,
      }),
    );
    screen.getByRole("combobox", { name: "Rows per page" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.click(await screen.findByRole("option", { name: "20" }));
    await waitFor(() =>
      expect(vi.mocked(getTeamMembers).mock.calls.at(-1)?.[1]).toMatchObject({
        page: 0,
        size: 20,
      }),
    );
    await waitFor(() =>
      expect(within(table).getAllByRole("row")).toHaveLength(21),
    );
    expect(
      screen.getByRole("combobox", { name: "Rows per page" }),
    ).toHaveTextContent("20");
    expect(screen.getByText("Showing 1–20 of 60")).toBeVisible();
  });
});
