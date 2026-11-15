let accessToken: string | null = null;
let revision = 0;
let loggingOut = false;
const unauthorizedListeners = new Set<() => void>();

export const authStorage = {
  getToken: () => accessToken,
  hasToken: () => accessToken !== null,
  setToken: (token: string) => {
    revision++;
    accessToken = token;
  },
  clearToken: () => {
    revision++;
    accessToken = null;
  },
  getRevision: () => revision,
  isLoggingOut: () => loggingOut,
  beginLogout: () => {
    loggingOut = true;
    revision++;
  },
  endLogout: () => {
    loggingOut = false;
    revision++;
  },
  replaceToken: (token: string, expectedRevision: number) => {
    if (loggingOut || revision !== expectedRevision) return false;
    accessToken = token;
    return true;
  },
  subscribeUnauthorized: (listener: () => void) => {
    unauthorizedListeners.add(listener);
    return () => unauthorizedListeners.delete(listener);
  },
  notifyUnauthorized: () => {
    unauthorizedListeners.forEach((listener) => listener());
  },
};
