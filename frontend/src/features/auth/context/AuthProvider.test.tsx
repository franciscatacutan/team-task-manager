import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "../hooks/useAuth";
import { authStorage } from "../utils/authStorage";
import { refresh, logout } from "../api/auth.api";
import { redirectToLogin } from "../utils/authNavigation";

vi.mock("../api/auth.api", () => ({ refresh: vi.fn(), logout: vi.fn() }));
vi.mock("../utils/authNavigation", () => ({ redirectToLogin: vi.fn() }));
vi.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    data: {
      id: "user",
      firstName: "Test",
      lastName: "User",
      email: "user@example.test",
      role: "USER",
    },
    isLoading: false,
  }),
}));
const data = {
  token: "current",
  expiresInSeconds: 900,
  user: {
    userId: "user",
    firstName: "Test",
    lastName: "User",
    email: "user@example.test",
    role: "USER" as const,
  },
};
function Consumer() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.isAuthenticated ? "Signed in" : "Signed out"}</p>
      <button disabled={auth.isLoggingOut} onClick={() => void auth.logout()}>
        Sign out
      </button>
      <span>{auth.isBootstrapping ? "Bootstrapping" : "Ready"}</span>
    </>
  );
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["private-data"], "Private data");
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  authStorage.endLogout();
  authStorage.clearToken();
  vi.mocked(refresh).mockImplementation(async () => {
    authStorage.replaceToken(data.token, authStorage.getRevision());
    return data;
  });
  vi.mocked(logout).mockResolvedValue(undefined);
});

describe("confirmed logout", () => {
  it("clears token/cache and navigates only after the server confirms revocation", async () => {
    let finish!: () => void;
    vi.mocked(logout).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const client = setup();
    await screen.findByText("Ready");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(authStorage.getToken()).toBe("current");
    expect(client.getQueryData(["private-data"])).toBe("Private data");
    expect(redirectToLogin).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    await act(async () => {
      finish();
    });
    expect(authStorage.hasToken()).toBe(false);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it("keeps auth/cache on failure, shows retry, and completes a successful retry", async () => {
    vi.mocked(logout)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const client = setup();
    await screen.findByText("Ready");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not confirm sign out",
    );
    expect(authStorage.getToken()).toBe("current");
    expect(client.getQueryData(["private-data"])).toBe("Private data");
    expect(screen.getByText("Signed in")).toBeInTheDocument();
    expect(redirectToLogin).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Retry sign out" }),
    );
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalledTimes(1));
    expect(authStorage.hasToken()).toBe(false);
  });

  it("lets the user dismiss a failed logout without losing the session", async () => {
    vi.mocked(logout).mockRejectedValue(new Error("offline"));
    setup();
    await screen.findByText("Ready");
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(authStorage.getToken()).toBe("current");
  });

  it("deduplicates repeated logout clicks", async () => {
    let finish!: () => void;
    vi.mocked(logout).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    await screen.findByText("Ready");
    await userEvent.dblClick(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
  });

  it("does not repopulate the user cache when bootstrap completes after logout", async () => {
    authStorage.setToken("current");
    let finish!: (value: typeof data) => void;
    vi.mocked(refresh).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const client = setup();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(redirectToLogin).toHaveBeenCalled());
    await act(async () => {
      finish(data);
    });
    expect(authStorage.hasToken()).toBe(false);
    expect(client.getQueryData(["me"])).toBeUndefined();
  });

  it("clears private state when revocation is reported by the API client", async () => {
    const client = setup();
    await screen.findByText("Ready");
    act(() => {
      authStorage.notifyUnauthorized();
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(authStorage.hasToken()).toBe(false);
    expect(redirectToLogin).toHaveBeenCalled();
  });
});
