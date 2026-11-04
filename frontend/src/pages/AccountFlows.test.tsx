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
import { MemoryRouter, Route, Routes } from "react-router";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
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
import AuthPage from "./AuthPage";
import SettingsPage from "./SettingsPage";
import { apiClient } from "@/api/apiClients";
import { authStorage } from "@/features/auth/utils/authStorage";
import { browserSession } from "@/features/auth/utils/sessionCoordinator";
import { queryKeys } from "@/common/query/queryKeys";

const state = vi.hoisted(() => ({
  user: undefined as { id: string } | undefined,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.user }),
}));
const user = {
  id: "account",
  firstName: "Test",
  lastName: "Person",
  email: "test@example.test",
  role: "USER" as const,
};
const auth = {
  token: "confirmed-token",
  expiresInSeconds: 900,
  user: { ...user, userId: user.id },
};
const originalAdapter = apiClient.defaults.adapter,
  originalScroll = HTMLElement.prototype.scrollIntoView;
const adapter = vi.fn();
let client: QueryClient;
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({ config, data, status, statusText: "", headers: {} });
const reject = (
  config: InternalAxiosRequestConfig,
  status: number,
  message = "Rejected",
) =>
  Promise.reject(
    new AxiosError(
      "HTTP error",
      "ERR_BAD_REQUEST",
      config,
      undefined,
      response(
        config,
        {
          message,
          error: status === 401 ? "INVALID_CREDENTIALS" : "BAD_REQUEST",
        },
        status,
      ),
    ),
  );
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  window.localStorage.clear();
  browserSession.sync();
  authStorage.endLogout();
  authStorage.clearToken();
  state.user = undefined;
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request: async (_: string, job: () => Promise<unknown>) => job() },
  });
  adapter.mockReset();
  apiClient.defaults.adapter = adapter;
  adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
    response(
      config,
      config.url === "/users/me"
        ? user
        : config.url?.startsWith("/auth/")
          ? auth
          : null,
    ),
  );
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
});
afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
  apiClient.defaults.adapter = originalAdapter;
  authStorage.clearToken();
  window.localStorage.clear();
});
function mount(page: "auth" | "settings", seed = true) {
  if (page === "settings") {
    authStorage.setToken("current-login");
    if (seed) client.setQueryData(queryKeys.session.current, user);
  }
  const view = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[page === "auth" ? "/login" : "/settings"]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/teams" element={<h1>Teams destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...render(view()), view };
}
const requests = (method: string) =>
  adapter.mock.calls
    .map((call) => call[0] as InternalAxiosRequestConfig)
    .filter((config) => config.method === method);
const body = (config: InternalAxiosRequestConfig) =>
  JSON.parse(config.data as string);
async function fillLogin(password = "legacy") {
  await userEvent.type(screen.getByLabelText(/^Email/), user.email);
  await userEvent.type(screen.getByLabelText(/^Password/), password);
}
async function registration() {
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
  await userEvent.type(screen.getByLabelText(/^First name/), " Éva-Marie ");
  await userEvent.type(screen.getByLabelText(/^Last name/), "O'Neil");
  await fillLogin("Strong123!");
  await userEvent.type(
    screen.getByLabelText(/^Confirm password/),
    "Strong123!",
  );
}
function held() {
  let reject!: (reason: unknown) => void;
  const promise = new Promise<AxiosResponse>((_, no) => {
    reject = no;
  });
  return { promise, reject };
}

describe("authentication feedback and validation", () => {
  it("authenticates a short existing password without transforming it", async () => {
    mount("auth");
    await fillLogin(" a ");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Teams destination" });
    expect(body(requests("post")[0])).toEqual({
      email: user.email,
      password: " a ",
    });
    expect(client.getQueryData(queryKeys.session.current)).toMatchObject(user);
  });
  it("connects required/malformed fields and does not submit invalid input", async () => {
    mount("auth");
    await userEvent.type(screen.getByLabelText(/^Email/), "bad-address");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const field = screen.getByLabelText(/^Email/);
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(field).toHaveAccessibleDescription("Enter a valid email address");
    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(
      "Password is required",
    );
    expect(requests("post")).toHaveLength(0);
  });
  it("registers trimmed identity fields, with matching password confirmation in the payload", async () => {
    mount("auth");
    await registration();
    await userEvent.click(
      within(screen.getByRole("form")).getByRole("button", {
        name: "Create account",
      }),
    );
    await screen.findByRole("heading", { name: "Teams destination" });
    expect(body(requests("post")[0])).toEqual({
      firstName: "Éva-Marie",
      lastName: "O'Neil",
      email: user.email,
      password: "Strong123!",
      confirmPassword: "Strong123!",
    });
  });
  it("applies new-password requirements during registration, not sign-in", async () => {
    mount("auth");
    await registration();
    await userEvent.clear(screen.getByLabelText(/^Password/));
    await userEvent.type(screen.getByLabelText(/^Password/), "simple");
    await userEvent.click(
      within(screen.getByRole("form")).getByRole("button", {
        name: "Create account",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/^Password/)).toHaveAttribute(
        "aria-invalid",
        "true",
      ),
    );
    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(
      /Password does not meet the requirements/,
    );
    expect(
      screen.getByLabelText(/^Confirm password/),
    ).toHaveAccessibleDescription("Passwords do not match");
    expect(requests("post")).toHaveLength(0);
  });
  it.each([401, 500, 429, 0])(
    "reports a %s login failure accurately and retains its password",
    async (status) => {
      adapter.mockImplementation((config: InternalAxiosRequestConfig) =>
        status
          ? reject(config, status, "Internal details should not appear")
          : Promise.reject(new AxiosError("offline", "ERR_NETWORK", config)),
      );
      mount("auth");
      await fillLogin();
      await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        status === 401
          ? "Email or password is incorrect."
          : status === 500
            ? "The service is temporarily unavailable."
            : status === 429
              ? "Too many attempts."
              : "Unable to reach the sign-in service.",
      );
      expect(alert).not.toHaveTextContent("Internal details");
      expect(screen.getByLabelText(/^Password/)).toHaveValue("legacy");
    },
  );
  it.each([false, true])(
    "locks submission, fields and mode switching; then retries the same draft (register=%s)",
    async (isRegister) => {
      const gate = held();
      adapter.mockImplementation(() => gate.promise);
      mount("auth");
      if (isRegister) await registration();
      else await fillLogin();
      const form = screen.getByRole("form");
      fireEvent.submit(form);
      fireEvent.submit(form);
      await waitFor(() => expect(requests("post")).toHaveLength(1));
      for (const input of form.querySelectorAll("input"))
        expect(input).toBeDisabled();
      for (const button of screen.getAllByRole("button"))
        expect(button).toBeDisabled();
      expect(form).toHaveAttribute("aria-busy", "true");
      const first = requests("post")[0];
      await act(async () =>
        gate.reject(
          new AxiosError(
            "Rejected",
            "ERR_BAD_REQUEST",
            first,
            undefined,
            response(first, { message: "Rejected" }, 500),
          ),
        ),
      );
      await screen.findByRole("alert");
      adapter.mockImplementation(async (config) => response(config, auth));
      await userEvent.click(
        within(form).getByRole("button", {
          name: isRegister ? "Create account" : "Sign in",
        }),
      );
      await screen.findByRole("heading", { name: "Teams destination" });
      expect(requests("post")).toHaveLength(2);
      expect(body(requests("post")[1])).toEqual(body(first));
    },
  );
  it("clears passwords, visibility and errors across form switches while keeping identity fields", async () => {
    adapter.mockImplementation((config) => reject(config, 500));
    mount("auth");
    await fillLogin();
    await userEvent.click(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(screen.getByLabelText(/^Password/)).toHaveValue("");
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/^Email/)).toHaveValue(user.email);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText(/^First name/),
      "Saved identity",
    );
    await userEvent.type(screen.getByLabelText(/^Confirm password/), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );
    expect(screen.getByLabelText(/^First name/)).toHaveValue("Saved identity");
    expect(screen.getByLabelText(/^Confirm password/)).toHaveValue("");
  });
  it("discards an old auth error after the active account changes", async () => {
    let fail!: (reason: unknown) => void;
    adapter.mockImplementation(
      () =>
        new Promise((_, no) => {
          fail = no;
        }),
    );
    const result = mount("auth");
    await fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(requests("post")).toHaveLength(1));
    authStorage.setToken("other-login");
    state.user = { id: "other" };
    result.rerender(result.view());
    await userEvent.type(screen.getByLabelText(/^Password/), "new draft");
    await act(async () => fail(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveValue("new draft");
  });
});

describe("settings credential forms", () => {
  it("uses vertical tab semantics and keyboard navigation", async () => {
    mount("settings");
    expect(screen.getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
    screen.getByRole("tab", { name: "Account" }).focus();
    await userEvent.keyboard("[ArrowDown]");
    expect(
      await screen.findByRole("form", { name: "Change password" }),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Security" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  async function fill(kind: "email" | "password") {
    if (kind === "password")
      await userEvent.click(screen.getByRole("tab", { name: "Security" }));
    else {
      await userEvent.clear(screen.getByLabelText("New email"));
      await userEvent.type(
        screen.getByLabelText("New email"),
        "draft@example.test",
      );
    }
    await userEvent.type(screen.getByLabelText("Current password"), "old");
    if (kind === "password") {
      await userEvent.type(screen.getByLabelText("New password"), "Strong123!");
      await userEvent.type(
        screen.getByLabelText("Confirm password"),
        "Strong123!",
      );
    }
  }
  it("connects validation to email/current-password fields", async () => {
    mount("settings");
    await userEvent.clear(screen.getByLabelText("New email"));
    await userEvent.type(screen.getByLabelText("New email"), "bad");
    await userEvent.click(screen.getByRole("button", { name: "Update email" }));
    await waitFor(() =>
      expect(screen.getByLabelText("New email")).toHaveAccessibleDescription(
        "Enter a valid email address",
      ),
    );
    expect(
      screen.getByLabelText("Current password"),
    ).toHaveAccessibleDescription("Current password is required");
    expect(requests("patch")).toHaveLength(0);
  });
  it.each(["email", "password"] as const)(
    "locks %s updates/tabs, retains rejected secrets and retries only on request",
    async (kind) => {
      const gate = held();
      adapter.mockImplementation((config) =>
        config.method === "patch"
          ? gate.promise
          : Promise.resolve(response(config, user)),
      );
      mount("settings");
      await fill(kind);
      const form = screen.getByRole("form");
      fireEvent.submit(form);
      fireEvent.submit(form);
      await waitFor(() => expect(requests("patch")).toHaveLength(1));
      for (const tab of screen.getAllByRole("tab")) expect(tab).toBeDisabled();
      for (const input of form.querySelectorAll("input"))
        expect(input).toBeDisabled();
      expect(form).toHaveAttribute("aria-busy", "true");
      const first = requests("patch")[0];
      await act(async () =>
        gate.reject(
          new AxiosError(
            "Rejected",
            "ERR_BAD_REQUEST",
            first,
            undefined,
            response(first, { message: "Current password incorrect" }, 400),
          ),
        ),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Current password incorrect",
      );
      expect(screen.getByLabelText("Current password")).toHaveValue("old");
      if (kind === "password")
        expect(screen.getByLabelText("New password")).toHaveValue("Strong123!");
      expect(requests("patch")).toHaveLength(1);
      adapter.mockImplementation((config) => reject(config, 500));
      await userEvent.click(
        screen.getByRole("button", {
          name: kind === "email" ? "Update email" : "Update password",
        }),
      );
      await waitFor(() => expect(requests("patch")).toHaveLength(2));
      expect(body(requests("patch")[1])).toEqual(body(first));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "temporarily unavailable",
      );
    },
  );
  it("clears sensitive drafts and errors on tab switches while retaining the email draft", async () => {
    adapter.mockImplementation((config) =>
      config.method === "patch"
        ? reject(config, 400, "Current password incorrect")
        : Promise.resolve(response(config, user)),
    );
    mount("settings");
    await fill("email");
    await userEvent.click(screen.getByRole("button", { name: "Update email" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    await userEvent.type(screen.getByLabelText("New password"), "temporary");
    await userEvent.click(screen.getByRole("tab", { name: "Account" }));
    expect(screen.getByLabelText("New email")).toHaveValue(
      "draft@example.test",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Security" }));
    expect(screen.getByLabelText("New password")).toHaveValue("");
  });
  it("keeps drafts during same-account refetches and isolates a new account from old failures", async () => {
    let fail!: (reason: unknown) => void;
    adapter.mockImplementation((config) =>
      config.method === "patch"
        ? new Promise((_, no) => {
            fail = no;
          })
        : Promise.resolve(response(config, user)),
    );
    mount("settings");
    await fill("email");
    await act(async () => {
      client.setQueryData(queryKeys.session.current, {
        ...user,
        firstName: "Updated elsewhere",
      });
    });
    expect(screen.getByLabelText("Current password")).toHaveValue("old");
    expect(screen.getByLabelText("New email")).toHaveValue(
      "draft@example.test",
    );
    await userEvent.click(screen.getByRole("button", { name: "Update email" }));
    await waitFor(() => expect(requests("patch")).toHaveLength(1));
    authStorage.setToken("next-login");
    await act(async () => {
      client.setQueryData(queryKeys.session.current, {
        ...user,
        id: "next",
        email: "next@example.test",
      });
    });
    await waitFor(() =>
      expect(screen.getByLabelText("New email")).toHaveValue(
        "next@example.test",
      ),
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    await act(async () => fail(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("explains uncertain credential changes instead of silently retrying or discarding the draft", async () => {
    adapter.mockImplementation((config) =>
      config.method === "patch"
        ? Promise.reject(new AxiosError("offline", "ERR_NETWORK", config))
        : Promise.resolve(response(config, user)),
    );
    mount("settings");
    await fill("password");
    await userEvent.click(
      screen.getByRole("button", { name: "Update password" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm the change. It may have succeeded.",
    );
    expect(screen.getByLabelText("New password")).toHaveValue("Strong123!");
    expect(requests("patch")).toHaveLength(1);
  });
  it("keeps confirmed credential changes on the existing session revocation flow", async () => {
    mount("settings");
    await fill("email");
    await userEvent.click(screen.getByRole("button", { name: "Update email" }));
    await waitFor(() => expect(authStorage.hasToken()).toBe(false));
    expect(
      requests("post").some((config) => config.url === "/auth/logout"),
    ).toBe(true);
  });
});
