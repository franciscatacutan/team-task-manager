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
import { apiClient } from "@/api/apiClients";
import { authStorage } from "@/features/auth/utils/authStorage";
import { queryKeys } from "@/common/query/queryKeys";
import type { User } from "../types/userType";
import EditUserDialog from "./EditUserDialog";
vi.mock("@/api/apiClients", () => ({ apiClient: { patch: vi.fn() } }));
const target: User = {
  id: "target",
  firstName: "Original",
  lastName: "Person",
  email: "old@example.test",
  role: "USER",
};
const superAdmin: User = { ...target, id: "super", role: "SUPER_ADMIN" };
const scroll = HTMLElement.prototype.scrollIntoView;
const clients: QueryClient[] = [];
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (scroll) HTMLElement.prototype.scrollIntoView = scroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
beforeEach(() => {
  vi.resetAllMocks();
  authStorage.endLogout();
  authStorage.setToken("test-login");
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
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  authStorage.clearToken();
});
function mount(viewer = superAdmin, subject = target) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  client.setQueryData(queryKeys.session.current, viewer);
  client.setQueryData(queryKeys.users.detail(subject.id), subject);
  const close = vi.fn();
  const element = (open: boolean, user = subject) => (
    <QueryClientProvider client={client}>
      <EditUserDialog
        currentUser={viewer}
        user={user}
        open={open}
        onOpenChange={close}
      />
    </QueryClientProvider>
  );
  return { ...render(element(true)), element, client, close };
}
async function changeName(value = "Changed") {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("First name"));
  await user.type(screen.getByLabelText("First name"), value);
  return user;
}
async function chooseAdmin() {
  const select = screen.getByRole("combobox", { name: "Global role" });
  select.focus();
  await userEvent.keyboard("[Enter]");
  await userEvent.click(screen.getByRole("option", { name: "Admin" }));
}
async function save() {
  const button = screen.getByRole("button", { name: "Save changes" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

describe("atomic user edit dialog", () => {
  it("submits names/email/role in one request and caches the confirmed response", async () => {
    const confirmed = {
      ...target,
      firstName: "Changed",
      email: "new@example.test",
      role: "ADMIN" as const,
    };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: confirmed });
    const { client, close } = mount();
    const user = await changeName(" Changed ");
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "new@example.test");
    await chooseAdmin();
    await save();
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith(
      "/admin/users/target",
      { firstName: "Changed", email: "new@example.test", role: "ADMIN" },
    );
    expect(client.getQueryData(queryKeys.users.detail(target.id))).toEqual(
      confirmed,
    );
    expect(client.getQueryData(queryKeys.session.current)).toEqual(superAdmin);
  });
  it("keeps ADMIN edits atomic without offering a global role control", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { ...target, firstName: "Changed" },
    });
    const { close } = mount({ ...superAdmin, role: "ADMIN" });
    expect(
      screen.queryByRole("combobox", { name: "Global role" }),
    ).not.toBeInTheDocument();
    await changeName();
    await save();
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith(
      "/admin/users/target",
      { firstName: "Changed" },
    );
  });
  it.each(["USER", "SUPER_ADMIN"] as const)(
    "keeps %s self edits on the profile-only endpoint",
    async (role) => {
      const self = { ...target, role };
      vi.mocked(apiClient.patch).mockResolvedValue({
        data: { ...self, firstName: "Changed" },
      });
      const { client, close } = mount(self, self);
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      await changeName();
      await save();
      await waitFor(() => expect(close).toHaveBeenCalledWith(false));
      expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith("/users/target", {
        firstName: "Changed",
        lastName: undefined,
      });
      expect(
        client.getQueryData<User>(queryKeys.session.current)?.firstName,
      ).toBe("Changed");
    },
  );
  it("preserves every draft field after rejection and retries one atomic request", async () => {
    vi.mocked(apiClient.patch)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { message: "Email already exists" } },
      })
      .mockResolvedValue({
        data: { ...target, firstName: "Changed", role: "ADMIN" },
      });
    const { client, close } = mount();
    await changeName();
    await chooseAdmin();
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already exists",
    );
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("First name")).toHaveValue("Changed");
    expect(screen.getByRole("combobox")).toHaveTextContent("Admin");
    expect(client.getQueryData(queryKeys.users.detail(target.id))).toEqual(
      target,
    );
    await save();
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(apiClient.patch).mock.calls.map((call) => call[0]),
    ).toEqual(["/admin/users/target", "/admin/users/target"]);
  });
  it("reports uncertain transport outcomes without claiming that nothing was saved", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue({ isAxiosError: true });
    mount();
    await changeName();
    await save();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm the save. Refresh the profile before trying again.",
    );
  });
  it("prevents duplicate submissions and dismissal while saving", async () => {
    let resolve!: (value: { data: User }) => void;
    const response = new Promise<{ data: User }>((yes) => {
      resolve = yes;
    });
    vi.mocked(apiClient.patch).mockReturnValue(response);
    const { close } = mount();
    await changeName();
    const button = screen.getByRole("button", { name: "Save changes" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.dblClick(button);
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("First name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByLabelText("Last name")).toBeDisabled();
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Global role" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("form", { name: "Edit user details" }),
    ).toHaveAttribute("aria-busy", "true");
    fireEvent.pointerDown(document.body);
    await userEvent.keyboard("[Escape]");
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ data: { ...target, firstName: "Changed" } });
    });
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });
  it("validates blanks and malformed email without sending a request", async () => {
    mount();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("First name"));
    await user.type(screen.getByLabelText("First name"), "   ");
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "invalid");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeDisabled(),
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it("disables edits for ADMIN viewing a SUPER_ADMIN account", async () => {
    mount({ ...superAdmin, role: "ADMIN" }, { ...target, role: "SUPER_ADMIN" });
    expect(screen.getByLabelText("First name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it("starts clean when reopened, while background refetches do not erase an open draft", async () => {
    const result = mount();
    await changeName("Draft");
    result.rerender(
      result.element(true, { ...target, firstName: "Remote update" }),
    );
    expect(screen.getByLabelText("First name")).toHaveValue("Draft");
    result.rerender(result.element(false));
    result.rerender(result.element(true));
    expect(screen.getByLabelText("First name")).toHaveValue("Original");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("disables unchanged saves", async () => {
    mount();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save changes" }),
      ).toBeDisabled(),
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it.each(["target", "account", "reopening"])(
    "does not close a new editor after a late old %s response",
    async (change) => {
      let resolve!: (value: { data: User }) => void;
      vi.mocked(apiClient.patch).mockReturnValue(
        new Promise<{ data: User }>((yes) => {
          resolve = yes;
        }),
      );
      const result = mount();
      await changeName();
      await save();
      await waitFor(() => expect(apiClient.patch).toHaveBeenCalledOnce());
      if (change === "account") authStorage.setToken("new-login");
      if (change === "reopening") result.rerender(result.element(false));
      result.rerender(
        result.element(
          true,
          change === "target"
            ? { ...target, id: "next-user", firstName: "Next" }
            : target,
        ),
      );
      await changeName("New draft");
      await act(async () =>
        resolve({ data: { ...target, firstName: "Changed" } }),
      );
      expect(result.close).not.toHaveBeenCalled();
      expect(screen.getByLabelText("First name")).toHaveValue("New draft");
    },
  );
  it("restores Close and Cancel after a failed save", async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error("offline"));
    const { close } = mount();
    await changeName();
    await save();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledWith(false);
  });
});
