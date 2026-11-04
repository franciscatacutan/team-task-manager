import { act, render, screen, waitFor } from "@testing-library/react";
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
import { apiClient } from "@/api/apiClients";
import { authStorage } from "@/features/auth/utils/authStorage";
import { queryKeys } from "@/common/query/queryKeys";
import type { User } from "../types/userType";
import { canLinkProfile } from "../utils/profileNavigation";
import UsersList from "./UsersList";
import MembersView from "@/features/teams/components/MembersView";
import ProfilePage from "@/pages/ProfilePage";

const state = vi.hoisted(() => ({
  viewer: {
    id: "viewer",
    firstName: "Viewer",
    lastName: "Person",
    email: "viewer@example.test",
    role: "USER" as "USER" | "ADMIN" | "SUPER_ADMIN",
  },
  archived: false,
  teamRole: "MEMBER" as "OWNER" | "ADMIN" | "MEMBER" | null,
  membership: "ok" as "ok" | "error" | "hold" | "mismatch",
  memberReadError: false,
  profileStatus: 200,
  edit: vi.fn(),
  reset: vi.fn(),
  openEdit: vi.fn(),
  openReset: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.viewer, isLoading: false }),
}));
vi.mock("@/api/apiClients", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
const peer: User = {
  id: "peer",
  firstName: "Peer",
  lastName: "Person",
  email: "peer@example.test",
  role: "USER",
};
const privileged: User = {
  ...peer,
  id: "super",
  firstName: "Privileged",
  role: "SUPER_ADMIN",
};
const date = "2026-11-05T00:00:00Z";
const page = (content: unknown[]) => ({
  content,
  page: 0,
  size: 10,
  totalPages: content.length ? 1 : 0,
  totalElements: content.length,
  last: true,
});
const rejected = (status: number) => ({
  isAxiosError: true,
  response: { status },
});
const originalScroll = HTMLElement.prototype.scrollIntoView;
let client: QueryClient,
  resolveMembership: ((value: unknown) => void) | undefined;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
beforeEach(() => {
  vi.clearAllMocks();
  state.viewer.role = "USER";
  state.archived = false;
  state.teamRole = "MEMBER";
  state.membership = "ok";
  state.memberReadError = false;
  state.profileStatus = 200;
  resolveMembership = undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
    },
  });
  vi.mocked(apiClient.get).mockImplementation(async (url) => {
    if (url === "/teams/TEAM/me") {
      if (state.membership === "error") throw rejected(403);
      if (state.membership === "hold")
        return new Promise((yes) => {
          resolveMembership = yes;
        });
      return {
        data: {
          userId:
            state.membership === "mismatch"
              ? "different-account"
              : state.viewer.id,
          role: state.teamRole,
        },
      };
    }
    if (url === "/teams/TEAM/members") {
      if (state.memberReadError) throw rejected(403);
      return {
        data: page([
          { ...state.viewer, teamRole: state.teamRole, joinedAt: date },
          { ...peer, teamRole: "MEMBER", joinedAt: date },
        ]),
      };
    }
    if (String(url).startsWith("/users/")) {
      if (state.profileStatus !== 200) throw rejected(state.profileStatus);
      const identity = String(url).endsWith("/viewer") ? state.viewer : peer;
      return {
        data:
          state.viewer.role === "USER" && identity.id !== state.viewer.id
            ? {
                id: identity.id,
                firstName: identity.firstName,
                lastName: identity.lastName,
                email: identity.email,
              }
            : identity,
      };
    }
    if (url === "/teams") return { data: page([]) };
    throw new Error(`Unexpected GET ${url}`);
  });
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
  vi.unstubAllGlobals();
});
function Directory() {
  return (
    <>
      <h1>User directory</h1>
      <UsersList
        users={[state.viewer, peer, privileged]}
        currentUser={state.viewer}
        isLoading={false}
        editUser={state.edit}
        resetPassword={state.reset}
        onEditUser={state.openEdit}
        onResetPassword={state.openReset}
        sortField="createdAt"
        sortOrder="asc"
        onSort={vi.fn()}
        onClearFilters={vi.fn()}
        hasActiveFilters={false}
      />
    </>
  );
}
function WorkspaceScope() {
  return (
    <Outlet
      context={{
        team: { key: "TEAM", deletedAt: state.archived ? date : null },
      }}
    />
  );
}
function mount(path = "/teams/TEAM/members") {
  authStorage.setToken(
    `header.${btoa(JSON.stringify({ sub: state.viewer.email, role: state.viewer.role, userId: state.viewer.id, exp: 9999999999 }))}.signature`,
  );
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/users" element={<Directory />} />
          <Route path="/teams/:teamKey" element={<WorkspaceScope />}>
            <Route path="members" element={<MembersView />} />
          </Route>
          <Route path="/users/:userId" element={<ProfilePage />} />
          <Route path="/teams" element={<h1>Workspace destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const peerLink = () =>
  screen.getByRole("link", { name: "View profile for Peer Person" });
const selfLink = () =>
  screen.getByRole("link", { name: "View profile for Viewer Person" });

describe("conservative profile links", () => {
  it.each(["MEMBER", "ADMIN", "OWNER"] as const)(
    "links active-team peers for a current team %s and opens the limited profile with Enter",
    async (teamRole) => {
      state.teamRole = teamRole;
      mount();
      const link = await screen.findByRole("link", {
        name: "View profile for Peer Person",
      });
      expect(link).toHaveAttribute("href", "/users/peer");
      link.focus();
      await userEvent.keyboard("[Enter]");
      expect(
        await screen.findByRole("heading", { name: "Peer Person" }),
      ).toBeVisible();
      expect(screen.getByText(peer.email)).toBeVisible();
      expect(screen.queryByText("Global Access")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Edit Profile" }),
      ).not.toBeInTheDocument();
      expect(apiClient.patch).not.toHaveBeenCalled();
    },
  );
  it.each(["OWNER", "ADMIN"] as const)(
    "keeps archived peers plain for an ordinary team %s, with self still linked",
    async (teamRole) => {
      state.archived = true;
      state.teamRole = teamRole;
      mount();
      await screen.findByText("Peer Person");
      expect(
        screen.queryByRole("link", { name: "View profile for Peer Person" }),
      ).not.toBeInTheDocument();
      expect(selfLink()).toHaveAttribute("href", "/users/viewer");
    },
  );
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "links archived profiles for a nonmember global %s",
    async (role) => {
      state.viewer.role = role;
      state.teamRole = null;
      state.membership = "error";
      state.archived = true;
      mount();
      expect(
        await screen.findByRole("link", {
          name: "View profile for Peer Person",
        }),
      ).toHaveAttribute("href", "/users/peer");
      expect(selfLink()).toBeVisible();
    },
  );
  it("waits for confirmed membership before enabling peer links", async () => {
    state.membership = "hold";
    mount();
    await screen.findByText("Peer Person");
    expect(
      screen.queryByRole("link", { name: "View profile for Peer Person" }),
    ).not.toBeInTheDocument();
    expect(selfLink()).toBeVisible();
    await waitFor(() => expect(resolveMembership).toBeDefined());
    await act(async () =>
      resolveMembership?.({
        data: { userId: state.viewer.id, role: "MEMBER" },
      }),
    );
    expect(
      await screen.findByRole("link", { name: "View profile for Peer Person" }),
    ).toBeVisible();
  });
  it.each(["error", "mismatch"] as const)(
    "does not offer peer links when membership is %s",
    async (membership) => {
      state.membership = membership;
      mount();
      await screen.findByText("Peer Person");
      expect(
        screen.queryByRole("link", { name: "View profile for Peer Person" }),
      ).not.toBeInTheDocument();
      expect(selfLink()).toBeVisible();
    },
  );
  it("removes peer links after a cached membership refresh is denied", async () => {
    mount();
    await screen.findByRole("link", { name: "View profile for Peer Person" });
    state.membership = "error";
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.teams.me("TEAM") });
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "View profile for Peer Person" }),
      ).not.toBeInTheDocument(),
    );
    expect(selfLink()).toBeVisible();
  });
  it("removes peer links after a cached member-list refresh is denied", async () => {
    mount();
    await screen.findByRole("link", { name: "View profile for Peer Person" });
    state.memberReadError = true;
    await act(async () => {
      await client.refetchQueries({
        queryKey: queryKeys.teams.members("TEAM"),
      });
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "View profile for Peer Person" }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("directory entry points and profile failures", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "lets global %s open profiles including privileged users without granting edit permission",
    async (role) => {
      state.viewer.role = role;
      mount("/users");
      expect(
        screen.getByRole("link", {
          name: "View profile for Privileged Person",
        }),
      ).toHaveAttribute("href", "/users/super");
      if (role === "ADMIN")
        expect(
          screen.queryByRole("button", {
            name: "Actions for Privileged Person",
          }),
        ).not.toBeInTheDocument();
      await userEvent.click(peerLink());
      expect(
        await screen.findByRole("heading", { name: "Peer Person" }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Edit Profile" }),
      ).toBeVisible();
    },
  );
  it("keeps directory edit/reset actions separate from navigation", async () => {
    state.viewer.role = "ADMIN";
    mount("/users");
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Peer Person" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit User" }));
    expect(state.edit).toHaveBeenCalledExactlyOnceWith(peer);
    expect(state.openEdit).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "User directory" }),
    ).toBeVisible();
    expect(state.reset).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Peer Person" }),
    );
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Reset password" }),
    );
    expect(state.reset).toHaveBeenCalledExactlyOnceWith(peer);
    expect(state.openReset).toHaveBeenCalledOnce();
  });
  it.each([403, 404])(
    "handles a fresh %s profile denial with a useful exit and no related-team request",
    async (status) => {
      state.viewer.role = "ADMIN";
      state.profileStatus = status;
      mount("/users");
      await userEvent.click(peerLink());
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Profile unavailable",
      );
      expect(screen.queryByText(peer.email)).not.toBeInTheDocument();
      expect(
        vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === "/teams"),
      ).toHaveLength(0);
      await userEvent.click(
        screen.getByRole("link", { name: "Open workspace" }),
      );
      expect(
        await screen.findByRole("heading", { name: "Workspace destination" }),
      ).toBeVisible();
    },
  );
  it("hides cached identity after profile access is lost and recovers on explicit retry", async () => {
    state.viewer.role = "ADMIN";
    mount("/users");
    await userEvent.click(peerLink());
    await screen.findByRole("heading", { name: "Peer Person" });
    state.profileStatus = 404;
    await act(async () => {
      await client.refetchQueries({
        queryKey: queryKeys.users.detail(peer.id),
      });
    });
    await screen.findByRole("alert");
    expect(screen.queryByText(peer.email)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Profile" }),
    ).not.toBeInTheDocument();
    state.profileStatus = 200;
    await userEvent.click(
      screen.getByRole("button", { name: "Retry profile" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Peer Person" }),
    ).toBeVisible();
  });
  it("fails closed without a viewer even when a caller claims shared-team access", () => {
    expect(canLinkProfile(undefined, peer.id, true)).toBe(false);
    expect(canLinkProfile(state.viewer, "", true)).toBe(false);
    expect(canLinkProfile(state.viewer, peer.id)).toBe(false);
  });
});
