import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransferOwnershipModal from "./TransferOwnershipModal";
import type { TeamMember } from "../types/team.type";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import { useTeamMembers } from "../hooks/useTeamMembers";

vi.mock("../hooks/useTransferOwnership", () => ({
  useTransferOwnership: vi.fn(),
}));
vi.mock("../hooks/useTeamMembers", () => ({ useTeamMembers: vi.fn() }));
vi.mock("../../../common/components/UserSelector", () => ({
  default: ({
    users,
    value,
    onChange,
  }: {
    users: TeamMember[];
    value?: string;
    onChange: (id: string) => void;
  }) => (
    <select
      aria-label="New owner"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose member</option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.firstName}
        </option>
      ))}
    </select>
  ),
}));

const owner: TeamMember = {
  id: "owner",
  firstName: "Old Owner",
  lastName: "Test",
  email: "owner@example.test",
  teamRole: "OWNER",
  globalRole: "ADMIN",
  joinedAt: "2026-11-03",
};
const candidate: TeamMember = {
  ...owner,
  id: "member",
  firstName: "Ordinary Member",
  teamRole: "MEMBER",
  globalRole: "USER",
};
const second: TeamMember = {
  ...candidate,
  id: "second",
  firstName: "Second Member",
};
const mutate = vi.fn();
const close = vi.fn();

describe("ownership transfer and super-admin recovery", () => {
  beforeEach(() => {
    vi.mocked(useTeamMembers).mockReturnValue({
      data: { content: [owner, candidate, second] },
    } as ReturnType<typeof useTeamMembers>);
    vi.mocked(useTransferOwnership).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTransferOwnership>);
  });

  it("allows an ordinary current member as successor and requires explicit confirmation", async () => {
    const user = userEvent.setup();
    render(
      <TransferOwnershipModal
        teamKey="TEAM-A"
        open
        onClose={close}
        members={[owner]}
        isCurrentOwner={false}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Recover team ownership" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Old Owner" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "New owner" }),
      "member",
    );
    expect(
      screen.getByRole("button", { name: "Transfer ownership" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Type TRANSFER to confirm"),
      "TRANSFER",
    );
    await user.click(
      screen.getByRole("button", { name: "Transfer ownership" }),
    );
    expect(mutate).toHaveBeenCalledExactlyOnceWith("member", {
      onSuccess: close,
    });
  });

  it("resets confirmation and preselection when reopening for a different member", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TransferOwnershipModal
        teamKey="TEAM-A"
        open
        onClose={close}
        members={[candidate, second]}
        preselectedUserId="member"
        isCurrentOwner
      />,
    );
    await user.type(
      screen.getByLabelText("Type TRANSFER to confirm"),
      "TRANSFER",
    );
    rerender(
      <TransferOwnershipModal
        teamKey="TEAM-A"
        open={false}
        onClose={close}
        members={[candidate, second]}
        preselectedUserId="second"
        isCurrentOwner
      />,
    );
    rerender(
      <TransferOwnershipModal
        teamKey="TEAM-A"
        open
        onClose={close}
        members={[candidate, second]}
        preselectedUserId="second"
        isCurrentOwner
      />,
    );
    expect(screen.getByRole("combobox", { name: "New owner" })).toHaveValue(
      "second",
    );
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Transfer ownership" }),
    ).toBeDisabled();
  });

  it("shows failed transfer feedback instead of closing the dialog", () => {
    vi.mocked(useTransferOwnership).mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new Error("failure"),
    } as unknown as ReturnType<typeof useTransferOwnership>);
    render(
      <TransferOwnershipModal
        teamKey="TEAM-A"
        open
        onClose={close}
        members={[candidate]}
        isCurrentOwner={false}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to transfer ownership",
    );
    expect(close).not.toHaveBeenCalled();
  });
});
