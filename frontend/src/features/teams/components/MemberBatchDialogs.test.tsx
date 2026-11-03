import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { TeamMember } from "../types/team.type";
import { addMembers, removeMembers } from "../api/teamMemberApi";
import { AddMemberForm } from "./AddMemberForm";
import AddMembersModal from "./AddMembersModal";
import RemoveMultiMembersModal from "./RemoveMultiMemberModal";
import RemoveMemberModal from "./RemoveMemberModal";

const state = vi.hoisted(() => ({
  members: [] as TeamMember[],
  isError: false,
  refetch: vi.fn(),
}));
vi.mock("../api/teamMemberApi", () => ({
  addMembers: vi.fn(),
  removeMembers: vi.fn(),
}));
vi.mock("../hooks/useAllTeamMembers", () => ({
  useAllTeamMembers: () => ({
    data: { content: state.members },
    isError: state.isError,
    refetch: state.refetch,
  }),
}));
vi.mock("../hooks/useAvailableUsers", () => ({
  useAvailableUsers: () => ({
    data: { content: state.members },
    isError: state.isError,
    refetch: state.refetch,
  }),
}));
vi.mock("../../../common/components/MultiUserSelector", () => ({
  default: ({
    users,
    selectedUsers,
    value,
    onChange,
    disabled,
  }: {
    users: TeamMember[];
    selectedUsers?: TeamMember[];
    value: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
  }) => (
    <fieldset disabled={disabled}>
      {users.map((user) => (
        <label key={user.id}>
          {user.firstName} {user.lastName}
          <input
            type="checkbox"
            checked={value.includes(user.id)}
            onChange={() =>
              onChange(
                value.includes(user.id)
                  ? value.filter((id) => id !== user.id)
                  : [...value, user.id],
              )
            }
          />
        </label>
      ))}
      <div aria-label="Selected users">
        {selectedUsers?.map((user) => (
          <span key={user.id}>
            {user.firstName} {user.lastName}
          </span>
        ))}
      </div>
    </fieldset>
  ),
}));
vi.mock("../../../components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: string;
    onValueChange: (role: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Role"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="MEMBER">Member</option>
      <option value="ADMIN">Admin</option>
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
  SelectValue: () => null,
}));
const first: TeamMember = {
  id: "first",
  firstName: "First",
  lastName: "User",
  email: "first@example.test",
  teamRole: "MEMBER",
  globalRole: "USER",
  joinedAt: "2026-01-01",
};
const second: TeamMember = {
  ...first,
  id: "second",
  firstName: "Second",
  email: "second@example.test",
};
const failed = {
  userId: second.id,
  reason: "Only the owner can change this member",
  code: "FORBIDDEN",
};
const users = [first, second].map((member) => ({
  ...member,
  role: "USER" as const,
}));
const close = vi.fn();
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}
async function selectBoth() {
  await userEvent.click(screen.getByRole("checkbox", { name: "First User" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Second User" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  state.members = [first, second];
  state.isError = false;
  vi.mocked(addMembers).mockResolvedValue({
    success: [first, second],
    failed: [],
  });
  vi.mocked(removeMembers).mockResolvedValue({
    success: [first.id, second.id],
    failed: [],
  });
});

describe("member addition results", () => {
  const form = (choices = users) => (
    <AddMemberForm
      canAssignAdmin
      teamKey="TEAM"
      users={choices}
      search=""
      onSearchChange={vi.fn()}
      onOpenChange={close}
    />
  );
  it("retains failed names and roles after refresh, and retries only failed selections", async () => {
    vi.mocked(addMembers)
      .mockResolvedValueOnce({ success: [first], failed: [failed] })
      .mockResolvedValueOnce({ success: [second], failed: [] });
    const view = render(form(), setup());
    await selectBoth();
    await userEvent.selectOptions(
      screen.getAllByRole("combobox", { name: "Role" })[1],
      "ADMIN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Added 1 member. 1 failed.",
    );
    expect(close).not.toHaveBeenCalled();
    view.rerender(form([]));
    expect(
      within(screen.getByRole("alert")).getByText("Second User"),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveValue("ADMIN");
    await userEvent.click(screen.getByRole("button", { name: "Add 1 member" }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(vi.mocked(addMembers).mock.calls[1][1]).toEqual({
      members: [{ userId: second.id, role: "ADMIN" }],
    });
  });
  it("keeps all-failed results open and reports every failure", async () => {
    vi.mocked(addMembers).mockResolvedValue({
      success: [],
      failed: [
        { ...failed, userId: first.id, reason: "First failure" },
        failed,
      ],
    });
    render(form(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Add 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Added 0 members. 2 failed.",
    );
    expect(screen.getByRole("button", { name: "Add 2 members" })).toBeEnabled();
    expect(close).not.toHaveBeenCalled();
  });
  it("keeps selections and explains uncertain completion on transport failure", async () => {
    vi.mocked(addMembers).mockRejectedValue(new Error("offline"));
    render(form(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Add 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "check what completed before retrying",
    );
    expect(screen.getByRole("button", { name: "Add 2 members" })).toBeEnabled();
    expect(close).not.toHaveBeenCalled();
  });
  it("closes after every entry succeeds", async () => {
    render(form(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Add 2 members" }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });
  it("resets failed selections when the add dialog is closed and reopened", async () => {
    vi.mocked(addMembers).mockResolvedValue({ success: [], failed: [failed] });
    const modal = (open: boolean) => (
      <AddMembersModal
        canAssignAdmin
        teamKey="TEAM"
        open={open}
        isLoading={false}
        onOpenChange={close}
      />
    );
    const view = render(modal(true), setup());
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Second User" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add 1 member" }));
    await screen.findByRole("alert");
    view.rerender(modal(false));
    view.rerender(modal(true));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add members" })).toBeDisabled();
  });
});

describe("bulk member removal results", () => {
  const modal = () => (
    <RemoveMultiMembersModal
      userTeamRole="OWNER"
      teamKey="TEAM"
      open
      isLoading={false}
      onOpenChange={close}
    />
  );
  it("shows partial results and retries only remaining members after the directory refreshes", async () => {
    vi.mocked(removeMembers)
      .mockResolvedValueOnce({ success: [first.id], failed: [failed] })
      .mockResolvedValueOnce({ success: [second.id], failed: [] });
    const view = render(modal(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Removed 1 member. 1 failed.",
    );
    expect(close).not.toHaveBeenCalled();
    state.members = [];
    view.rerender(modal());
    expect(
      within(screen.getByRole("alert")).getByText("Second User"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove 1 member" }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(vi.mocked(removeMembers).mock.calls[1][1]).toEqual({
      userIds: [second.id],
    });
  });
  it("does not close an all-failed removal", async () => {
    vi.mocked(removeMembers).mockResolvedValue({
      success: [],
      failed: [{ ...failed, userId: first.id }, failed],
    });
    render(modal(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Removed 0 members. 2 failed.",
    );
    expect(close).not.toHaveBeenCalled();
  });
  it("keeps selections after a transport failure", async () => {
    vi.mocked(removeMembers).mockRejectedValue(new Error("offline"));
    render(modal(), setup());
    await selectBoth();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove 2 members" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to confirm",
    );
    expect(
      screen.getByRole("button", { name: "Remove 2 members" }),
    ).toBeEnabled();
  });
});

describe("single member removal", () => {
  const modal = (open = true) => (
    <RemoveMemberModal
      teamKey="TEAM"
      member={second}
      open={open}
      onClose={close}
    />
  );
  it("keeps a failed removal open and closes only after a successful retry", async () => {
    vi.mocked(removeMembers)
      .mockResolvedValueOnce({ success: [], failed: [failed] })
      .mockResolvedValueOnce({ success: [second.id], failed: [] });
    render(modal(), setup());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(failed.reason);
    expect(close).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
  it("reports network failure without closing", async () => {
    vi.mocked(removeMembers).mockRejectedValue(new Error("offline"));
    render(modal(), setup());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to confirm",
    );
    expect(close).not.toHaveBeenCalled();
  });
  it("clears old errors when reopened", async () => {
    vi.mocked(removeMembers).mockResolvedValue({
      success: [],
      failed: [failed],
    });
    const view = render(modal(), setup());
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await screen.findByRole("alert");
    view.rerender(modal(false));
    view.rerender(modal(true));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

it("provides retry feedback when available users cannot be loaded", async () => {
  state.isError = true;
  render(
    <AddMembersModal
      canAssignAdmin
      teamKey="TEAM"
      open
      isLoading={false}
      onOpenChange={close}
    />,
    setup(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to load available users",
  );
  await userEvent.click(screen.getByRole("button", { name: "Retry loading" }));
  expect(state.refetch).toHaveBeenCalledTimes(1);
});
