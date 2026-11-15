import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import TransferOwnershipModal from "./TransferOwnershipModal";
import type { TeamMember } from "../types/team.type";
import { apiClient } from "@/api/apiClients";
import { authStorage } from "@/features/auth/utils/authStorage";

vi.mock("@/api/apiClients", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
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
const originalScroll = HTMLElement.prototype.scrollIntoView;
let client: QueryClient;
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.endLogout();
  authStorage.setToken("owner-login");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  vi.mocked(apiClient.get).mockResolvedValue({
    data: {
      content: [owner, candidate, second],
      page: 0,
      totalPages: 1,
      totalElements: 3,
      size: 20,
      last: true,
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
  authStorage.clearToken();
});
function mount() {
  const close = vi.fn();
  const element = (
    open = true,
    preselectedUserId: string | null = "member",
    teamKey = "TEAM",
    isCurrentOwner = true,
  ) => (
    <QueryClientProvider client={client}>
      <TransferOwnershipModal
        teamKey={teamKey}
        open={open}
        onClose={close}
        members={[owner, candidate, second]}
        preselectedUserId={preselectedUserId}
        isCurrentOwner={isCurrentOwner}
      />
    </QueryClientProvider>
  );
  return { ...render(element()), element, close };
}
const confirm = () =>
  userEvent.type(screen.getByLabelText("Type TRANSFER to confirm"), "TRANSFER");
const action = () => screen.getByRole("button", { name: "Transfer ownership" });
function deferred() {
  let resolve!: (value: { data: TeamMember }) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<{ data: TeamMember }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const failure = {
  isAxiosError: true,
  response: { status: 409, data: { message: "Team changed. Please retry." } },
};

describe("ownership transfer and recovery dialog lifecycle", () => {
  it("allows a regular current member as successor, excludes the owner and requires exact confirmation", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { ...candidate, teamRole: "OWNER" },
    });
    const result = mount();
    result.rerender(result.element(true, null, "TEAM", false));
    expect(
      screen.getByRole("heading", { name: "Recover team ownership" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("combobox", { name: "New owner" }));
    await screen.findByRole("option", { name: /Ordinary Member/ });
    expect(
      screen.queryByRole("option", { name: /Old Owner/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("option", { name: /Ordinary Member/ }),
    );
    expect(action()).toBeDisabled();
    await userEvent.type(
      screen.getByLabelText("Type TRANSFER to confirm"),
      "transfer",
    );
    expect(action()).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Type TRANSFER to confirm"));
    await confirm();
    await userEvent.click(action());
    await waitFor(() => expect(result.close).toHaveBeenCalledOnce());
    expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith(
      "/teams/TEAM/transfer/member",
    );
  });

  it("locks all controls and dismissal, guards duplicate clicks and closes on confirmed success", async () => {
    const request = deferred();
    vi.mocked(apiClient.patch).mockReturnValue(request.promise);
    const { close } = mount();
    await confirm();
    const submit = action();
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "New owner" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Transferring..." }),
    ).toBeDisabled();
    expect(
      screen.getByRole("form", { name: "Transfer team ownership" }),
    ).toHaveAttribute("aria-busy", "true");
    await userEvent.keyboard("[Escape]");
    fireEvent.pointerDown(document.body);
    expect(close).not.toHaveBeenCalled();
    await act(async () =>
      request.resolve({ data: { ...candidate, teamRole: "OWNER" } }),
    );
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  it("retains the same successor and confirmation after failure and retries without automatic sends", async () => {
    vi.mocked(apiClient.patch)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ data: { ...candidate, teamRole: "OWNER" } });
    const { close } = mount();
    await confirm();
    await userEvent.click(action());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Team changed. Please retry.",
    );
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue(
      "TRANSFER",
    );
    expect(
      screen.getByRole("combobox", { name: "New owner" }),
    ).toHaveTextContent("Ordinary Member");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    expect(close).not.toHaveBeenCalled();
    expect(apiClient.patch).toHaveBeenCalledOnce();
    await userEvent.click(action());
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(apiClient.patch).mock.calls[0]).toEqual(
      vi.mocked(apiClient.patch).mock.calls[1],
    );
  });

  it("reports uncertain network outcomes without clearing or automatically resubmitting confirmation", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue({ isAxiosError: true });
    mount();
    await confirm();
    await userEvent.click(action());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm the change. Refresh the data before retrying.",
    );
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue(
      "TRANSFER",
    );
    expect(apiClient.patch).toHaveBeenCalledOnce();
  });

  it("resets drafts after close/reopen while a same-target background refresh keeps them", async () => {
    const result = mount();
    await confirm();
    result.rerender(result.element());
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue(
      "TRANSFER",
    );
    result.rerender(result.element(false));
    result.rerender(result.element(true, "second"));
    expect(
      screen.getByRole("combobox", { name: "New owner" }),
    ).toHaveTextContent("Second Member");
    expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue("");
    expect(action()).toBeDisabled();
  });

  it.each(["team", "successor", "account", "reopening"])(
    "ignores a late response after changing %s",
    async (change) => {
      const request = deferred();
      vi.mocked(apiClient.patch).mockReturnValue(request.promise);
      const result = mount();
      await confirm();
      await userEvent.click(action());
      await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
      if (change === "account") authStorage.setToken("next-login");
      if (change === "reopening") result.rerender(result.element(false));
      result.rerender(
        result.element(
          true,
          change === "successor" ? "second" : "member",
          change === "team" ? "OTHER" : "TEAM",
        ),
      );
      expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue("");
      await userEvent.type(
        screen.getByLabelText("Type TRANSFER to confirm"),
        "New draft",
      );
      await act(async () => request.resolve({ data: candidate }));
      expect(result.close).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Type TRANSFER to confirm")).toHaveValue(
        "New draft",
      );
    },
  );

  it("allows Close, Cancel and Escape when idle", async () => {
    const { close } = mount();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledOnce();
    close.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
    close.mockClear();
    await userEvent.keyboard("[Escape]");
    expect(close).toHaveBeenCalledOnce();
  });
});
