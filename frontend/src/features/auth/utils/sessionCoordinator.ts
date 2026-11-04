import { isAxiosError } from "axios";
import type { AuthResponse } from "../types/auth.types";
import { authStorage } from "./authStorage";

export class AuthSessionChangedError extends Error {
  constructor() {
    super("The browser's active session changed. Please try again.");
  }
}
export class SignedOutError extends Error {}
export class SessionCoordinationError extends Error {
  constructor() {
    super(
      "Session coordination is unavailable. Use an up-to-date browser with site storage enabled.",
    );
  }
}
type SharedState = { id: string; kind: "active" | "signed-out" };
export type SessionEvent =
  | { type: "changed" | "signed-out" | "ready"; remote: boolean }
  | { type: "unavailable"; error: unknown };
type Tokens = Pick<
  typeof authStorage,
  | "getRevision"
  | "getToken"
  | "hasToken"
  | "setToken"
  | "clearToken"
  | "replaceToken"
  | "isLoggingOut"
  | "notifyUnauthorized"
>;
export interface SessionEnvironment {
  tokens: Tokens;
  read: () => string | null;
  write: (value: string) => void;
  lock: <T>(job: () => Promise<T>) => Promise<T>;
  wake: (listener: () => void) => () => void;
  id: () => string;
}
const initial: SharedState = { id: "initial", kind: "active" };

/** Storage contains only an opaque generation and signed-out flag, never a token or identity. */
export function createSessionCoordinator(env: SessionEnvironment) {
  let seen: SharedState | undefined;
  const listeners = new Set<(event: SessionEvent) => void>();
  let stop: (() => void) | undefined;
  const emit = (event: SessionEvent) =>
    listeners.forEach((listener) => listener(event));
  function read(): SharedState {
    try {
      const raw = env.read();
      if (!raw) return initial;
      if (raw.length > 200) throw new Error("Invalid session marker");
      const state: unknown = JSON.parse(raw);
      if (
        !state ||
        typeof state !== "object" ||
        !("id" in state) ||
        typeof state.id !== "string" ||
        !("kind" in state) ||
        (state.kind !== "active" && state.kind !== "signed-out")
      )
        throw new Error("Invalid session marker");
      return { id: state.id, kind: state.kind };
    } catch {
      throw new SessionCoordinationError();
    }
  }
  function sync() {
    const latest = read();
    if (!seen) {
      seen = latest;
      return false;
    }
    if (seen.id === latest.id) return false;
    seen = latest;
    env.tokens.clearToken();
    emit({
      type: latest.kind === "signed-out" ? "signed-out" : "changed",
      remote: true,
    });
    return true;
  }
  function publish(kind: SharedState["kind"], token?: string) {
    const state = { id: env.id(), kind };
    try {
      env.write(JSON.stringify(state).padEnd(128, " "));
    } catch {
      env.tokens.clearToken();
      emit({ type: "unavailable", error: new SessionCoordinationError() });
      throw new SessionCoordinationError();
    }
    seen = state;
    if (token) env.tokens.setToken(token);
    else env.tokens.clearToken();
    emit({
      type: kind === "signed-out" ? "signed-out" : "changed",
      remote: false,
    });
  }
  async function exclusive<T>(
    job: () => Promise<T>,
    rejectMissedChange = false,
  ) {
    if (sync() && rejectMissedChange) throw new AuthSessionChangedError();
    const expected = read().id;
    return env.lock(async () => {
      sync();
      if (read().id !== expected) throw new AuthSessionChangedError();
      try {
        env.write(JSON.stringify(read()).padEnd(128, " "));
      } catch {
        throw new SessionCoordinationError();
      }
      return job();
    });
  }
  return {
    sync,
    subscribe(listener: (event: SessionEvent) => void) {
      listeners.add(listener);
      if (!stop)
        stop = env.wake(() => {
          try {
            sync();
          } catch (error) {
            emit({ type: "unavailable", error });
          }
        });
      try {
        sync();
      } catch (error) {
        emit({ type: "unavailable", error });
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          stop?.();
          stop = undefined;
        }
      };
    },
    async authenticate(request: () => Promise<AuthResponse>) {
      return exclusive(async () => {
        const data = await request();
        publish("active", data.token);
        return data;
      });
    },
    async refresh(request: () => Promise<AuthResponse>) {
      const revision = env.tokens.getRevision();
      return exclusive(async () => {
        if (read().kind === "signed-out") throw new SignedOutError();
        if (env.tokens.isLoggingOut() || env.tokens.getRevision() !== revision)
          throw new AuthSessionChangedError();
        try {
          const data = await request();
          if (sync() || !env.tokens.replaceToken(data.token, revision))
            throw new AuthSessionChangedError();
          return data;
        } catch (error) {
          if (
            isAxiosError(error) &&
            error.response?.status === 401 &&
            env.tokens.getRevision() === revision
          ) {
            publish("signed-out");
            env.tokens.notifyUnauthorized();
          }
          throw error;
        }
      });
    },
    async logout(request: () => Promise<unknown>) {
      return exclusive(async () => {
        await request();
        publish("signed-out");
      }, true);
    },
    async changeCredentials(
      request: () => Promise<unknown>,
      clearCookie: () => Promise<unknown>,
    ) {
      const revision = env.tokens.getRevision();
      return exclusive(async () => {
        if (
          !env.tokens.hasToken() ||
          env.tokens.isLoggingOut() ||
          env.tokens.getRevision() !== revision
        )
          throw new AuthSessionChangedError();
        await request();
        // Revocation is already confirmed. Cookie cleanup cannot undo a credential change.
        try {
          await clearCookie();
        } catch {
          /* The server has already revoked every session. */
        }
        publish("signed-out");
      }, true);
    },
    ready() {
      emit({ type: "ready", remote: false });
    },
  };
}

const scope = `team-task-manager:${import.meta.env.VITE_API_URL ?? "default"}:session`;
export const browserSession = createSessionCoordinator({
  tokens: authStorage,
  read: () => window.localStorage.getItem(scope),
  write: (value) => window.localStorage.setItem(scope, value),
  id: () => crypto.randomUUID(),
  lock: async (job) => {
    if (!navigator.locks?.request) throw new SessionCoordinationError();
    return navigator.locks.request(scope, job);
  },
  wake: (listener) => {
    const storage = (event: StorageEvent) => {
      if (event.key === scope || event.key === null) listener();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", listener);
    window.addEventListener("pageshow", listener);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", listener);
      window.removeEventListener("pageshow", listener);
    };
  },
});
