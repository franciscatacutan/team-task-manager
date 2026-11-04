import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/apiClients";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { User } from "../types/userType";
import ResetUserPasswordDialog from "./ResetUserPasswordDialog";
vi.mock("@/api/apiClients", () => ({ apiClient: { patch: vi.fn() } }));
const target: User = {
  id: "target-a",
  firstName: "Ada",
  lastName: "Person",
  email: "ada@example.test",
  role: "USER",
};
const other: User = { ...target, id: "target-b", firstName: "Grace" };
const password = "Temporary123!";
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(apiClient.patch).mockReset();
  authStorage.setToken("reset-test-login");
});
afterEach(() => {
  client.clear();
  authStorage.clearToken();
});
function mount() {
  const close = vi.fn();
  function Host({
    user = target,
    initialOpen = true,
  }: {
    user?: User | null;
    initialOpen?: boolean;
  }) {
    const [open, setOpen] = useState(initialOpen);
    return (
      <QueryClientProvider client={client}>
        <button onClick={() => setOpen(true)}>Open reset</button>
        <ResetUserPasswordDialog
          open={open}
          user={user}
          onOpenChange={(value) => {
            close(value);
            setOpen(value);
          }}
        />
      </QueryClientProvider>
    );
  }
  return { ...render(<Host />), Host, close, user: userEvent.setup() };
}
async function fill(
  user: ReturnType<typeof userEvent.setup>,
  confirmation = password,
) {
  await user.type(screen.getByLabelText(/^New password/), password);
  await user.type(screen.getByLabelText(/^Confirm password/), confirmation);
}
const serverError = {
  isAxiosError: true,
  response: { status: 409, data: { message: "Reset rejected. Please retry." } },
};
describe("target-scoped password reset", () => {
  it("submits the existing target/payload once, then closes only after confirmation", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.patch).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { user, close } = mount();
    await fill(user);
    fireEvent.submit(screen.getByRole("form"));
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
      expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith(
        "/admin/users/target-a/password",
        { newPassword: password },
      ),
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText(/^New password/)).toBeDisabled();
    expect(screen.getByLabelText(/^Confirm password/)).toBeDisabled();
    for (const label of ["Cancel", "Close", "Resetting..."])
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Resetting password");
    await user.keyboard("{Escape}");
    fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
    expect(close).not.toHaveBeenCalled();
    await act(async () => resolve({}));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("catches a rejection, retains the same-user draft and permits explicit retry", async () => {
    vi.mocked(apiClient.patch)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({});
    const { user, close } = mount();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reset rejected. Please retry.",
    );
    expect(screen.getByLabelText(/^New password/)).toHaveValue(password);
    expect(screen.getByLabelText(/^Confirm password/)).toHaveValue(password);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
  });
  it.each(["Cancel", "Close", "Escape"])(
    "clears values and request errors after idle %s dismissal",
    async (action) => {
      vi.mocked(apiClient.patch).mockRejectedValue(serverError);
      const { user } = mount();
      await fill(user);
      await user.click(screen.getByRole("button", { name: "Reset password" }));
      await screen.findByRole("alert");
      if (action === "Escape") await user.keyboard("{Escape}");
      else await user.click(screen.getByRole("button", { name: action }));
      await user.click(screen.getByRole("button", { name: "Open reset" }));
      expect(screen.getByLabelText(/^New password/)).toHaveValue("");
      expect(screen.getByLabelText(/^Confirm password/)).toHaveValue("");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reset password" }),
      ).toBeDisabled();
    },
  );
  it("isolates drafts/errors when the target changes while open", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(serverError);
    const { user, rerender, Host } = mount();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await screen.findByRole("alert");
    rerender(<Host user={other} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      /Grace Person/,
    );
    expect(screen.getByLabelText(/^New password/)).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("preserves the open draft during a same-target profile refresh", async () => {
    const { user, rerender, Host } = mount();
    await fill(user);
    rerender(<Host user={{ ...target, lastName: "Updated" }} />);
    expect(screen.getByLabelText(/^New password/)).toHaveValue(password);
  });
  it.each(["resolve", "reject"] as const)(
    "ignores a late %s from an old target after retargeting",
    async (outcome) => {
      let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
      vi.mocked(apiClient.patch).mockImplementation(
        () =>
          new Promise((done, fail) => {
            resolve = done;
            reject = fail;
          }),
      );
      const { user, close, rerender, Host } = mount();
      await fill(user);
      await user.click(screen.getByRole("button", { name: "Reset password" }));
      await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
      rerender(<Host user={other} />);
      await user.type(
        screen.getByLabelText(/^New password/),
        "New user's draft",
      );
      await act(async () => {
        if (outcome === "resolve") resolve({});
        else reject(serverError);
      });
      expect(close).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^New password/)).toHaveValue(
        "New user's draft",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );
  it("does not let a previous opening's success close a reopened dialog", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.patch).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const close = vi.fn();
    const tree = (open: boolean) => (
      <QueryClientProvider client={client}>
        <ResetUserPasswordDialog
          open={open}
          user={target}
          onOpenChange={close}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    const user = userEvent.setup();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
    rerender(tree(false));
    rerender(tree(true));
    await act(async () => resolve({}));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^New password/)).toHaveValue("");
  });
  it("fences a completed reset from an old login", async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(apiClient.patch).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { user, close } = mount();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
    authStorage.setToken("different-login");
    await act(async () => resolve({}));
    expect(close).not.toHaveBeenCalled();
  });
  it.each([new Error("offline"), { isAxiosError: true }])(
    "displays a useful fallback without automatically retrying",
    async (failure) => {
      vi.mocked(apiClient.patch).mockRejectedValue(failure);
      const { user } = mount();
      await fill(user);
      await user.click(screen.getByRole("button", { name: "Reset password" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "isAxiosError" in failure
          ? "request may have succeeded"
          : "Unable to reset this password",
      );
      expect(apiClient.patch).toHaveBeenCalledOnce();
    },
  );
  it("connects validation to uniquely identified fields and keeps existing password rules", async () => {
    const { user } = mount();
    await user.type(screen.getByLabelText(/^New password/), "short");
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8");
    expect(screen.getByLabelText(/^New password/)).toHaveAccessibleDescription(
      /at least 8/,
    );
    await user.clear(screen.getByLabelText(/^New password/));
    await fill(user, "Mismatch123!");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match",
    );
    expect(screen.getByLabelText(/^Confirm password/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it("mounts no editor without an open dialog and a target", () => {
    const { rerender, Host } = mount();
    rerender(<Host user={null} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
