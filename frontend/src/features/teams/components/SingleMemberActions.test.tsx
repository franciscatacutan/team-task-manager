import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
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
import {
  getTeamMembers,
  removeMembers,
  updateMemberRole,
} from "../api/teamMemberApi";
import { getTeamMe } from "../api/teamApi";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { getTeamPermissions } from "../utils/teamPermissions";
import type { RemoveMembersResult, TeamMember } from "../types/team.type";
import type { UserRole } from "@/features/users/types/userRole";
import MembersList from "./MembersList";
import MemberRoleControl from "./MemberRoleControl";
import RemoveMemberModal from "./RemoveMemberModal";

vi.mock("../api/teamMemberApi", () => ({
  getTeamMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMembers: vi.fn(),
}));
vi.mock("../api/teamApi", () => ({ getTeamMe: vi.fn() }));
const first: TeamMember = {
  id: "first",
  firstName: "Alice",
  lastName: "Member",
  email: "alice@example.test",
  teamRole: "MEMBER",
  joinedAt: "2026-11-05T00:00:00Z",
};
const second: TeamMember = {
  ...first,
  id: "second",
  firstName: "Bob",
  email: "bob@example.test",
};
const owner: TeamMember = {
  ...first,
  id: "owner",
  firstName: "Olivia",
  email: "olivia@example.test",
  teamRole: "OWNER",
};
const close = vi.fn();
let client: QueryClient;
let members: TeamMember[];
let me = { userId: owner.id, role: "OWNER" as TeamMember["teamRole"] };
const originalScroll = HTMLElement.prototype.scrollIntoView;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.setToken("checkpoint-3-session");
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  members = [owner, first, second];
  me = { userId: owner.id, role: "OWNER" };
  vi.mocked(getTeamMe).mockImplementation(async () => ({ ...me }));
  vi.mocked(getTeamMembers).mockImplementation(async () => ({
    content: members.map((member) => ({ ...member })),
    page: 0,
    size: 10,
    totalElements: members.length,
    totalPages: 1,
    last: true,
  }));
  vi.mocked(updateMemberRole).mockImplementation(async (_team, id, role) => {
    members = members.map((member) =>
      member.id === id ? { ...member, teamRole: role } : member,
    );
    return members.find((member) => member.id === id)!;
  });
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
});
function mount(ui: React.ReactNode) {
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const failed = {
  success: [],
  failed: [
    { userId: first.id, reason: "Member cannot be removed", code: "CONFLICT" },
  ],
};
const removal = (member = first, teamKey = "TEAM", open = true) => (
  <RemoveMemberModal
    member={member}
    teamKey={teamKey}
    open={open}
    onClose={close}
  />
);
const control = (member = first, teamKey = "TEAM", disabled = false) => (
  <MemberRoleControl member={member} teamKey={teamKey} disabled={disabled} />
);
const roleName = (member = first) =>
  `Team role for ${member.firstName} ${member.lastName}`;
async function chooseRole(member = first, role = "Admin") {
  screen.getByRole("combobox", { name: roleName(member) }).focus();
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.click(await screen.findByRole("option", { name: role }));
}
function Directory({
  globalRole = "USER",
  teamRole = "OWNER",
  archived = false,
}: {
  globalRole?: UserRole;
  teamRole?: TeamMember["teamRole"];
  archived?: boolean;
}) {
  const query = useTeamMembers("TEAM", { page: 0 });
  return (
    <MembersList
      permissions={getTeamPermissions({
        globalRole,
        teamRole,
        isReadOnly: archived,
      })}
      teamKey="TEAM"
      members={query.data?.content ?? []}
      isLoading={query.isLoading}
      sort="joinedAt,desc"
      onSortChange={vi.fn()}
      pagination={{
        page: 0,
        size: 10,
        totalPages: 1,
        totalElements: 3,
        onPageChange: vi.fn(),
        onSizeChange: vi.fn(),
      }}
    />
  );
}

describe("single removal safeguards", () => {
  it("locks duplicate submissions and every dismissal until the request settles", async () => {
    const request = deferred<RemoveMembersResult>();
    vi.mocked(removeMembers).mockReturnValue(request.promise);
    mount(removal());
    const button = screen.getByRole("button", { name: "Remove" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Removing Alice Member",
    );
    expect(screen.getByRole("button", { name: "Removing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.pointerDown(document.body, {
      button: 0,
      pointerType: "mouse",
      pointerId: 1,
    });
    expect(close).not.toHaveBeenCalled();
    expect(removeMembers).toHaveBeenCalledExactlyOnceWith("TEAM", {
      userIds: [first.id],
    });
    await act(async () => request.reject(new Error("offline")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to confirm",
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it("does not close for an unconfirmed result or another member's success", async () => {
    vi.mocked(removeMembers).mockResolvedValue({
      success: [second.id],
      failed: [],
    });
    mount(removal());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to confirm removal",
    );
    expect(close).not.toHaveBeenCalled();
  });
  it("retains the failed member and uses exactly that member on retry", async () => {
    vi.mocked(removeMembers)
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce({ success: [first.id], failed: [] });
    mount(removal());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alice Member: Member cannot be removed",
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(vi.mocked(removeMembers).mock.calls.map((call) => call[1])).toEqual([
      { userIds: [first.id] },
      { userIds: [first.id] },
    ]);
  });
  it.each(["member", "team", "account", "reopening"])(
    "isolates late removal results after changing %s",
    async (change) => {
      const request = deferred<RemoveMembersResult>();
      vi.mocked(removeMembers).mockReturnValue(request.promise);
      const view = mount(removal());
      await userEvent.click(screen.getByRole("button", { name: "Remove" }));
      if (change === "account") authStorage.setToken("another-account");
      if (change === "reopening") view.rerender(removal(first, "TEAM", false));
      view.rerender(
        removal(
          change === "member" ? second : first,
          change === "team" ? "OTHER" : "TEAM",
        ),
      );
      await act(async () =>
        request.resolve({ success: [first.id], failed: [] }),
      );
      expect(close).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    },
  );
  it("suppresses a late transport error after the login changes without a render", async () => {
    const request = deferred<RemoveMembersResult>();
    vi.mocked(removeMembers).mockReturnValue(request.promise);
    mount(removal());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    authStorage.setToken("another-account");
    await act(async () => request.reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
  });
});

describe("member role feedback", () => {
  it("keeps confirmed values, locks all role controls during a save and refreshes after success", async () => {
    const request = deferred<TeamMember>();
    vi.mocked(updateMemberRole).mockImplementationOnce(async () => {
      const response = await request.promise;
      members = members.map((member) =>
        member.id === response.id ? response : member,
      );
      return response;
    });
    mount(<Directory />);
    await screen.findByRole("combobox", { name: roleName() });
    await chooseRole();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Updating team role for Alice Member",
    );
    expect(
      screen.getByRole("combobox", { name: roleName() }),
    ).toHaveTextContent("Member");
    expect(screen.getByRole("combobox", { name: roleName() })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: roleName(second) }),
    ).toBeDisabled();
    expect(updateMemberRole).toHaveBeenCalledExactlyOnceWith(
      "TEAM",
      first.id,
      "ADMIN",
    );
    await act(async () => request.resolve({ ...first, teamRole: "ADMIN" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: roleName() }),
      ).toHaveTextContent("Admin"),
    );
    expect(
      screen.getByRole("combobox", { name: roleName(second) }),
    ).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("shows a named failure with exact retry and clears it only after the next attempt", async () => {
    vi.mocked(updateMemberRole).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { message: "Role changed elsewhere" } },
    });
    mount(<Directory />);
    await screen.findByRole("combobox", { name: roleName() });
    await chooseRole();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Alice Member's change to Admin. Role changed elsewhere",
    );
    expect(
      screen.getByRole("combobox", { name: roleName() }),
    ).toHaveTextContent("Member");
    expect(updateMemberRole).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Retry changing team role for Alice Member to Admin",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: roleName() }),
      ).toHaveTextContent("Admin"),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(vi.mocked(updateMemberRole).mock.calls).toEqual([
      ["TEAM", first.id, "ADMIN"],
      ["TEAM", first.id, "ADMIN"],
    ]);
  });
  it("keeps failures attached to their member while another member changes", async () => {
    vi.mocked(updateMemberRole).mockRejectedValueOnce(new Error("offline"));
    mount(<Directory />);
    await screen.findByRole("combobox", { name: roleName() });
    await chooseRole();
    await screen.findByRole("alert");
    await chooseRole(second);
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: roleName(second) }),
      ).toHaveTextContent("Admin"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Alice Member");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Bob Member");
    expect(
      screen.getByRole("button", {
        name: /Retry changing team role for Alice/,
      }),
    ).toBeEnabled();
  });
  it("avoids a duplicate retry when refreshed server state already confirms the requested role", async () => {
    vi.mocked(updateMemberRole).mockImplementationOnce(async () => {
      members = members.map((member) =>
        member.id === first.id ? { ...member, teamRole: "ADMIN" } : member,
      );
      throw { isAxiosError: true };
    });
    mount(<Directory />);
    await screen.findByRole("combobox", { name: roleName() });
    await chooseRole();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The member list now confirms Admin. No retry is needed.",
    );
    expect(
      screen.queryByRole("button", { name: /Retry changing/ }),
    ).not.toBeInTheDocument();
    expect(updateMemberRole).toHaveBeenCalledOnce();
  });
  it.each(["member", "team", "account"])(
    "isolates late role errors after changing %s",
    async (change) => {
      const request = deferred<TeamMember>();
      vi.mocked(updateMemberRole).mockReturnValue(request.promise);
      const view = mount(control());
      await chooseRole();
      if (change === "account") authStorage.setToken("another-account");
      view.rerender(
        control(
          change === "member" ? second : first,
          change === "team" ? "OTHER" : "TEAM",
        ),
      );
      await act(async () => request.reject(new Error("stale failure")));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    },
  );
  it("disables retries when the target becomes non-editable", async () => {
    vi.mocked(updateMemberRole).mockRejectedValue(new Error("offline"));
    const view = mount(control());
    await chooseRole();
    await screen.findByRole("alert");
    view.rerender(control(first, "TEAM", true));
    const retry = screen.getByRole("button", { name: /Retry changing/ });
    expect(retry).toBeDisabled();
    await userEvent.click(retry);
    expect(updateMemberRole).toHaveBeenCalledOnce();
  });
  it.each([
    {
      name: "regular member",
      globalRole: "USER",
      teamRole: "MEMBER",
      allowed: false,
    },
    {
      name: "team admin",
      globalRole: "USER",
      teamRole: "ADMIN",
      allowed: false,
    },
    {
      name: "global admin nonmember",
      globalRole: "ADMIN",
      teamRole: null,
      allowed: false,
    },
    {
      name: "super-admin recovery",
      globalRole: "SUPER_ADMIN",
      teamRole: null,
      allowed: true,
    },
    {
      name: "archived owner",
      globalRole: "USER",
      teamRole: "OWNER",
      archived: true,
      allowed: false,
    },
  ] as const)(
    "preserves editing rules for $name",
    async ({ globalRole, teamRole, allowed, ...rest }) => {
      mount(
        <Directory
          globalRole={globalRole}
          teamRole={teamRole}
          archived={"archived" in rest && rest.archived}
        />,
      );
      await screen.findByText(first.email);
      if (allowed)
        expect(
          screen.getByRole("combobox", { name: roleName() }),
        ).toBeEnabled();
      else
        expect(
          screen.queryByRole("combobox", { name: roleName() }),
        ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: roleName(owner) }),
      ).not.toBeInTheDocument();
    },
  );
  it("keeps the current user's role locked and the owner non-editable", async () => {
    me = { userId: first.id, role: "OWNER" };
    mount(<Directory />);
    expect(
      await screen.findByRole("combobox", { name: roleName() }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("combobox", { name: roleName(owner) }),
    ).not.toBeInTheDocument();
    const ownerRow = screen.getByText(owner.email).closest("tr")!;
    expect(
      within(ownerRow).queryByRole("button", { name: /Actions/ }),
    ).not.toBeInTheDocument();
  });
});
