import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPendingTeamInvitations,
  revokeTeamInvitation,
} from "../api/teamMemberApi";
import PendingInvitationsDialog from "./PendingInvitationsDialog";

vi.mock("../api/teamMemberApi", () => ({
  getPendingTeamInvitations: vi.fn(),
  revokeTeamInvitation: vi.fn(),
}));

const invitation = {
  id: "invite-1",
  email: "pending@example.test",
  expiresAt: "2030-06-14T12:00:00Z",
};
const response = {
  content: [invitation],
  page: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
  last: true,
};

function setup() {
  const user = userEvent.setup();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <PendingInvitationsDialog teamKey="TEAM" />
    </QueryClientProvider>,
  );
  return user;
}

describe("pending team invitations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getPendingTeamInvitations).mockResolvedValue(response);
  });

  it("loads on open, retries a failed list, and navigates to the next page", async () => {
    vi.mocked(getPendingTeamInvitations)
      .mockRejectedValueOnce(new Error("List unavailable"))
      .mockResolvedValueOnce({
        ...response,
        last: false,
        totalPages: 2,
        totalElements: 11,
      })
      .mockResolvedValueOnce({
        ...response,
        content: [{ ...invitation, email: "page-two@example.test" }],
        page: 1,
        totalPages: 2,
        totalElements: 11,
      });
    const user = setup();
    expect(getPendingTeamInvitations).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Pending invites" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load invitations.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    const dialog = screen.getByRole("dialog", { name: "Pending invites" });
    const row = await within(dialog).findByRole("listitem");
    expect(row).toHaveTextContent(invitation.email);
    expect(row.querySelector("time")).toHaveAttribute(
      "datetime",
      invitation.expiresAt,
    );
    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(
      await within(dialog).findByText("page-two@example.test"),
    ).toBeVisible();
    expect(getPendingTeamInvitations).toHaveBeenLastCalledWith(
      "TEAM",
      1,
      expect.any(AbortSignal),
    );
  });

  it("requires confirmation, blocks dismissal during revoke, and refreshes on successful retry", async () => {
    let rejectRevoke!: (reason: Error) => void;
    vi.mocked(revokeTeamInvitation)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRevoke = reject;
          }),
      )
      .mockImplementationOnce(async () => {
        vi.mocked(getPendingTeamInvitations).mockResolvedValue({
          ...response,
          content: [],
          totalElements: 0,
          totalPages: 0,
        });
      });

    const user = setup();
    await user.click(screen.getByRole("button", { name: "Pending invites" }));
    const dialog = screen.getByRole("dialog", { name: "Pending invites" });
    const rowAction = await within(dialog).findByRole("button", {
      name: `Revoke invite for ${invitation.email}`,
    });
    await user.click(rowAction);
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveFocus();
    await user.click(cancel);
    expect(rowAction).toHaveFocus();
    expect(revokeTeamInvitation).not.toHaveBeenCalled();

    await user.click(rowAction);
    await user.click(
      within(dialog).getByRole("button", { name: "Revoke invite" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "Revoking…" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Close" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeVisible();

    rejectRevoke(new Error("Revoke unavailable"));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Unable to revoke the invitation.",
    );
    expect(rowAction).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Revoke invite" }),
    );
    expect(
      await within(dialog).findByText("Invitation is no longer pending."),
    ).toBeVisible();
    expect(within(dialog).getByText("No pending invites.")).toBeVisible();
    expect(revokeTeamInvitation).toHaveBeenCalledTimes(2);
    expect(revokeTeamInvitation).toHaveBeenLastCalledWith(
      "TEAM",
      invitation.id,
    );
  });
});
