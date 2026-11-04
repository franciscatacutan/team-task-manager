import {
  updateAccountEmail,
  updatePassword,
} from "@/features/settings/api/settingsApi";
import { browserSession } from "@/features/auth/utils/sessionCoordinator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { apiClient, AuthSessionChangedError } from "./apiClients";
import { refresh, logout } from "../features/auth/api/auth.api";
import { authStorage } from "../features/auth/utils/authStorage";

const originalAdapter = apiClient.defaults.adapter;
const adapter = vi.fn();
const payload = {
  token: "fresh-token",
  expiresInSeconds: 900,
  user: {
    userId: "user",
    firstName: "Test",
    lastName: "User",
    email: "user@example.test",
    role: "USER",
  },
};
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({ config, data, status, statusText: "", headers: {} });
const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError(
    "Unauthorized",
    "ERR_BAD_REQUEST",
    config,
    undefined,
    response(config, {}, 401),
  );
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  window.localStorage.clear();
  browserSession.sync();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, callback: () => Promise<unknown>) =>
        callback(),
    },
  });
  adapter.mockReset();
  apiClient.defaults.adapter = adapter;
  authStorage.endLogout();
  authStorage.clearToken();
});
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
  authStorage.endLogout();
  authStorage.clearToken();
});

describe("authentication request lifecycle", () => {
  it("sends the current bearer on logout and keeps HttpOnly cookie credentials enabled", async () => {
    authStorage.setToken("current");
    adapter.mockImplementation(async (config) =>
      response(config, undefined, 204),
    );
    await logout();
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe("/auth/logout");
    expect(config.headers.Authorization).toBe("Bearer current");
    expect(config.withCredentials).toBe(true);
  });

  it.each([true, false])(
    "shares one refresh across simultaneous 401 retries (bootstrap=%s)",
    async (bootstrap) => {
      authStorage.setToken("old-token");
      const gate = deferred<AxiosResponse>();
      let refreshConfig!: InternalAxiosRequestConfig;
      adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (config.url === "/auth/refresh") {
          refreshConfig = config;
          return gate.promise;
        }
        if (config.headers.Authorization === "Bearer old-token")
          throw unauthorized(config);
        return response(config, { authorized: true });
      });
      const boot = bootstrap ? refresh() : undefined;
      const first = apiClient.get("/users/me"),
        second = apiClient.get("/teams");
      await waitFor(() =>
        expect(
          adapter.mock.calls.filter(
            ([config]) => config.url === "/auth/refresh",
          ),
        ).toHaveLength(1),
      );
      gate.resolve(response(refreshConfig, payload));
      await expect(first).resolves.toMatchObject({
        data: { authorized: true },
      });
      await expect(second).resolves.toMatchObject({
        data: { authorized: true },
      });
      if (boot) await expect(boot).resolves.toEqual(payload);
      expect(authStorage.getToken()).toBe("fresh-token");
      expect(
        adapter.mock.calls.filter(([config]) => config.url === "/auth/refresh"),
      ).toHaveLength(1);
    },
  );

  it.each(["clear", "login", "logout"])(
    "ignores a pending refresh after a session %s",
    async (change) => {
      authStorage.setToken("old");
      const gate = deferred<AxiosResponse>();
      adapter.mockImplementation(() => gate.promise);
      const result = refresh().catch((error) => error);
      await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
      if (change === "clear") authStorage.clearToken();
      if (change === "login") authStorage.setToken("new-login");
      if (change === "logout") {
        authStorage.beginLogout();
        await expect(refresh()).rejects.toBeInstanceOf(AuthSessionChangedError);
        authStorage.clearToken();
        authStorage.endLogout();
      }
      gate.resolve(response(adapter.mock.calls[0][0], payload));
      expect(await result).toBeInstanceOf(AuthSessionChangedError);
      expect(authStorage.getToken()).toBe(
        change === "login" ? "new-login" : null,
      );
    },
  );

  it("an obsolete refresh failure cannot clear a newer login", async () => {
    authStorage.setToken("old");
    const gate = deferred<AxiosResponse>();
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/auth/refresh") return gate.promise;
      throw unauthorized(config);
    });
    const result = apiClient.get("/users/me").catch((error) => error);
    await waitFor(() => expect(adapter).toHaveBeenCalledTimes(2));
    authStorage.setToken("new-login");
    const listener = vi.fn();
    const unsubscribe = authStorage.subscribeUnauthorized(listener);
    try {
      gate.reject(unauthorized(adapter.mock.calls[1][0]));
      expect(await result).toBeInstanceOf(AxiosError);
      expect(authStorage.getToken()).toBe("new-login");
      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("a failed refresh clears credentials and announces an expired session", async () => {
    authStorage.setToken("old");
    const listener = vi.fn();
    const unsubscribe = authStorage.subscribeUnauthorized(listener);
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorized(config);
    });
    try {
      await expect(apiClient.get("/users/me")).rejects.toBeInstanceOf(
        AxiosError,
      );
      expect(authStorage.hasToken()).toBe(false);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(
        adapter.mock.calls.filter(([config]) => config.url === "/auth/refresh"),
      ).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("does not automatically refresh a failed logout or discard local credentials", async () => {
    authStorage.setToken("current");
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorized(config);
    });
    await expect(logout()).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(authStorage.getToken()).toBe("current");
  });

  it("does not start automatic refresh while logout is pending", async () => {
    authStorage.setToken("current");
    authStorage.beginLogout();
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      throw unauthorized(config);
    });
    await expect(apiClient.get("/users/me")).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does not replay an earlier user's failed request after a new login", async () => {
    authStorage.setToken("old-user");
    const gate = deferred<AxiosResponse>();
    adapter.mockImplementation(() => gate.promise);
    const result = apiClient.get("/teams").catch((error) => error);
    await waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    authStorage.setToken("new-user");
    gate.reject(unauthorized(adapter.mock.calls[0][0]));
    expect(await result).toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(authStorage.getToken()).toBe("new-user");
  });

  it("announces a shared refresh failure only once for concurrent 401s", async () => {
    authStorage.setToken("old");
    const gate = deferred<AxiosResponse>();
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/auth/refresh") return gate.promise;
      throw unauthorized(config);
    });
    const listener = vi.fn();
    const unsubscribe = authStorage.subscribeUnauthorized(listener);
    try {
      const first = apiClient.get("/users/me").catch((error) => error);
      const second = apiClient.get("/teams").catch((error) => error);
      await waitFor(() =>
        expect(
          adapter.mock.calls.filter(
            ([config]) => config.url === "/auth/refresh",
          ),
        ).toHaveLength(1),
      );
      const config = adapter.mock.calls.find(
        ([config]) => config.url === "/auth/refresh",
      )![0];
      gate.reject(unauthorized(config));
      await Promise.all([first, second]);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(authStorage.hasToken()).toBe(false);
    } finally {
      unsubscribe();
    }
  });
});

it("keeps credentials when refresh cannot reach the server", async () => {
  authStorage.setToken("current");
  const listener = vi.fn();
  const unsubscribe = authStorage.subscribeUnauthorized(listener);
  adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
    if (config.url === "/auth/refresh")
      throw new AxiosError("offline", "ERR_NETWORK", config);
    throw unauthorized(config);
  });
  try {
    await expect(apiClient.get("/teams")).rejects.toBeInstanceOf(AxiosError);
    expect(authStorage.getToken()).toBe("current");
    expect(listener).not.toHaveBeenCalled();
  } finally {
    unsubscribe();
  }
});

it.each(["email", "password"])(
  "refreshes outside the credential lock before retrying an expired %s write",
  async (kind) => {
    let held = false;
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (_name: string, callback: () => Promise<unknown>) => {
          expect(held).toBe(false);
          held = true;
          try {
            return await callback();
          } finally {
            held = false;
          }
        },
      },
    });
    authStorage.setToken("expired");
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/auth/refresh") return response(config, payload);
      if (config.url === "/auth/logout")
        return response(config, undefined, 204);
      if (config.headers.Authorization === "Bearer expired")
        throw unauthorized(config);
      return response(config, undefined, 204);
    });
    if (kind === "email")
      await updateAccountEmail({
        currentPassword: "current",
        newEmail: "new@example.test",
      });
    else
      await updatePassword("user", {
        currentPassword: "current",
        newPassword: "new-password",
      });
    expect(adapter.mock.calls.map(([config]) => config.url)).toEqual([
      kind === "email" ? "/users/me/email" : "/users/user/password",
      "/auth/refresh",
      kind === "email" ? "/users/me/email" : "/users/user/password",
      "/auth/logout",
    ]);
    expect(authStorage.hasToken()).toBe(false);
  },
);

it("does not retry a credential change as a newly selected account", async () => {
  authStorage.setToken("old");
  adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
    authStorage.setToken("new");
    throw unauthorized(config);
  });
  await expect(
    updateAccountEmail({
      currentPassword: "current",
      newEmail: "new@example.test",
    }),
  ).rejects.toBeInstanceOf(AuthSessionChangedError);
  expect(adapter).toHaveBeenCalledOnce();
  expect(authStorage.getToken()).toBe("new");
});
