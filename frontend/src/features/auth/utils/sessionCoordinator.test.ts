import { describe, expect, it, vi } from "vitest";
import {
  createSessionCoordinator,
  AuthSessionChangedError,
  SessionCoordinationError,
  SignedOutError,
  type SessionEnvironment,
} from "./sessionCoordinator";
import type { AuthResponse } from "../types/auth.types";
function data(user = "a"): AuthResponse {
  return {
    token: `token-${user}`,
    expiresInSeconds: 900,
    user: {
      userId: user,
      firstName: "Test",
      lastName: "User",
      email: `${user}@example.test`,
      role: "USER",
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function cluster() {
  let stored: string | null = null,
    sequence = 0;
  let queue = Promise.resolve();
  const wakes = new Map<string, () => void>();
  function tab(id: string) {
    let token: string | null = null,
      revision = 0,
      loggingOut = false;
    const tokens = {
      getToken: () => token,
      hasToken: () => !!token,
      getRevision: () => revision,
      setToken: (value: string) => {
        token = value;
        revision++;
      },
      clearToken: () => {
        token = null;
        revision++;
      },
      replaceToken: (value: string, expected: number) => {
        if (revision !== expected || loggingOut) return false;
        token = value;
        return true;
      },
      isLoggingOut: () => loggingOut,
      notifyUnauthorized: vi.fn(),
    };
    const env: SessionEnvironment = {
      tokens,
      id: () => `${id}-${++sequence}`,
      read: () => stored,
      write: (value) => {
        const changed = value !== stored;
        stored = value;
        if (changed)
          for (const [other, wake] of wakes)
            if (other !== id) queueMicrotask(wake);
      },
      lock: async (job) => {
        const previous = queue;
        let release!: () => void;
        queue = new Promise<void>((yes) => {
          release = yes;
        });
        await previous;
        try {
          return await job();
        } finally {
          release();
        }
      },
      wake: (listener) => {
        wakes.set(id, listener);
        return () => {
          wakes.delete(id);
        };
      },
    };
    const coordinator = createSessionCoordinator(env);
    coordinator.sync();
    return {
      coordinator,
      tokens,
      env,
      setLoggingOut: (value: boolean) => {
        loggingOut = value;
      },
    };
  }
  return {
    tab,
    raw: () => stored,
    corrupt: (value: string) => {
      stored = value;
    },
  };
}
describe("browser session coordination", () => {
  it("serializes refresh requests from two independent tabs using the latest cookie", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    let running = 0,
      max = 0,
      cookie = 0;
    const refresh = async () => {
      running++;
      max = Math.max(max, running);
      const readCookie = cookie;
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(readCookie).toBe(cookie);
      cookie++;
      running--;
      return data(String(cookie));
    };
    await Promise.all([
      a.coordinator.refresh(refresh),
      b.coordinator.refresh(refresh),
    ]);
    expect(max).toBe(1);
    expect(cookie).toBe(2);
    expect(a.tokens.getToken()).toBe("token-1");
    expect(b.tokens.getToken()).toBe("token-2");
  });
  it("announces a login, clears the other tab's token, and stores no token or identity", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    b.tokens.setToken("old");
    const listener = vi.fn();
    const stop = b.coordinator.subscribe(listener);
    await a.coordinator.authenticate(async () => data("secret-user"));
    await Promise.resolve();
    expect(b.tokens.getToken()).toBeNull();
    expect(listener).toHaveBeenCalledWith({ type: "changed", remote: true });
    const marker = JSON.parse(shared.raw()!);
    expect(Object.keys(marker).sort()).toEqual(["id", "kind"]);
    expect(shared.raw()).not.toContain("secret-user");
    stop();
  });
  it("lets another tab refresh into the current account after a login", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    await a.coordinator.authenticate(async () => data("new"));
    expect(b.coordinator.sync()).toBe(true);
    await b.coordinator.refresh(async () => data("new"));
    expect(b.tokens.getToken()).toBe("token-new");
  });
  it("finds a missed logout notice on the next shared-state check", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    b.tokens.setToken("old");
    await a.coordinator.logout(async () => {});
    expect(b.coordinator.sync()).toBe(true);
    expect(b.tokens.hasToken()).toBe(false);
    const request = vi.fn();
    await expect(b.coordinator.refresh(request)).rejects.toBeInstanceOf(
      SignedOutError,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("does not announce logout or discard tokens if logout fails", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    a.tokens.setToken("a");
    b.tokens.setToken("b");
    await expect(
      a.coordinator.logout(async () => {
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
    expect(a.tokens.getToken()).toBe("a");
    expect(b.tokens.getToken()).toBe("b");
    expect(JSON.parse(shared.raw()!).kind).toBe("active");
  });
  it("does not refresh an old queued session after confirmed logout", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    const gate = deferred<void>();
    const logout = a.coordinator.logout(() => gate.promise);
    const request = vi.fn(async () => data());
    const refresh = b.coordinator.refresh(request).catch((error) => error);
    gate.resolve();
    await logout;
    expect(await refresh).toBeInstanceOf(AuthSessionChangedError);
    expect(request).not.toHaveBeenCalled();
  });
  it("does not send a queued logout against a newer login", async () => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    const gate = deferred<AuthResponse>();
    const login = a.coordinator.authenticate(() => gate.promise);
    const request = vi.fn();
    const logout = b.coordinator.logout(request).catch((error) => error);
    gate.resolve(data("new"));
    await login;
    expect(await logout).toBeInstanceOf(AuthSessionChangedError);
    expect(request).not.toHaveBeenCalled();
    expect(a.tokens.getToken()).toBe("token-new");
  });
  it("signs out after confirmed credential revocation even if cookie cleanup fails", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    a.tokens.setToken("old");
    await a.coordinator.changeCredentials(
      async () => {},
      async () => {
        throw new Error("cleanup offline");
      },
    );
    expect(a.tokens.hasToken()).toBe(false);
    expect(JSON.parse(shared.raw()!).kind).toBe("signed-out");
  });
  it("keeps the session when a credential write is rejected", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    a.tokens.setToken("old");
    const cleanup = vi.fn();
    await expect(
      a.coordinator.changeCredentials(async () => {
        throw new Error("bad password");
      }, cleanup),
    ).rejects.toThrow("bad password");
    expect(cleanup).not.toHaveBeenCalled();
    expect(a.tokens.getToken()).toBe("old");
  });
  it("publishes a confirmed expired session once", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    a.tokens.setToken("old");
    await expect(
      a.coordinator.refresh(async () => {
        throw { isAxiosError: true, response: { status: 401 } };
      }),
    ).rejects.toBeDefined();
    expect(a.tokens.hasToken()).toBe(false);
    expect(a.tokens.notifyUnauthorized).toHaveBeenCalledOnce();
    expect(JSON.parse(shared.raw()!).kind).toBe("signed-out");
  });
  it.each([403, 500, 503])(
    "does not turn refresh failure %s into a browser logout",
    async (status) => {
      const shared = cluster(),
        a = shared.tab("a");
      a.tokens.setToken("old");
      await expect(
        a.coordinator.refresh(async () => {
          throw { isAxiosError: true, response: { status } };
        }),
      ).rejects.toBeDefined();
      expect(a.tokens.getToken()).toBe("old");
      expect(a.tokens.notifyUnauthorized).not.toHaveBeenCalled();
    },
  );
  it("cannot install a pending refresh over a newer local login", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    const gate = deferred<AuthResponse>();
    const result = a.coordinator
      .refresh(() => gate.promise)
      .catch((error) => error);
    await Promise.resolve();
    await Promise.resolve();
    a.tokens.setToken("new");
    gate.resolve(data("old"));
    expect(await result).toBeInstanceOf(AuthSessionChangedError);
    expect(a.tokens.getToken()).toBe("new");
  });
  it("rejects malformed or inaccessible shared storage before sending a request", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    const request = vi.fn();
    shared.corrupt("not-json");
    await expect(a.coordinator.authenticate(request)).rejects.toBeInstanceOf(
      SessionCoordinationError,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("checks write access before a cookie-changing request", async () => {
    const shared = cluster(),
      a = shared.tab("a");
    a.env.write = () => {
      throw new Error("storage denied");
    };
    const request = vi.fn();
    await expect(a.coordinator.authenticate(request)).rejects.toBeInstanceOf(
      SessionCoordinationError,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("removes event listeners when the last subscriber leaves", () => {
    const shared = cluster(),
      a = shared.tab("a");
    const stop = a.coordinator.subscribe(vi.fn());
    stop();
    const wake = vi.spyOn(a.env, "wake");
    a.coordinator.subscribe(vi.fn())();
    expect(wake).toHaveBeenCalledOnce();
  });
});

it.each(["logout", "credentials"])(
  "rejects a missed account change before starting %s",
  async (kind) => {
    const shared = cluster(),
      a = shared.tab("a"),
      b = shared.tab("b");
    b.tokens.setToken("old");
    await a.coordinator.authenticate(async () => data("new"));
    const request = vi.fn();
    const operation =
      kind === "logout"
        ? b.coordinator.logout(request)
        : b.coordinator.changeCredentials(request, vi.fn());
    await expect(operation).rejects.toBeInstanceOf(AuthSessionChangedError);
    expect(request).not.toHaveBeenCalled();
  },
);

it("does not retarget a queued credential change after a local session replacement", async () => {
  const shared = cluster(),
    a = shared.tab("a"),
    b = shared.tab("b");
  const gate = deferred<AuthResponse>();
  a.tokens.setToken("original");
  const first = b.coordinator.refresh(() => gate.promise);
  const request = vi.fn();
  const change = a.coordinator
    .changeCredentials(request, vi.fn())
    .catch((error) => error);
  await Promise.resolve();
  a.tokens.setToken("replacement");
  gate.resolve(data());
  await first;
  expect(await change).toBeInstanceOf(AuthSessionChangedError);
  expect(request).not.toHaveBeenCalled();
});
