import {
  browserSession,
  AuthSessionChangedError,
} from "@/features/auth/utils/sessionCoordinator";
export { AuthSessionChangedError } from "@/features/auth/utils/sessionCoordinator";
import axios from "axios";
import { apiBaseURL } from "./apiConfig";

declare module "axios" {
  interface AxiosRequestConfig {
    /** Cookie-changing requests already hold the browser lock; refresh only after releasing it. */
    skipSessionRefresh?: boolean;
  }
}
import { authStorage } from "../features/auth/utils/authStorage";
import type { AuthResponse } from "../features/auth/types/auth.types";

/*
 * Create an Axios instance with a base URL
 */

export const apiClient = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Track the login that sent each request so an old 401 cannot replay work as a new user.
const requestRevisions = new WeakMap<object, number>();

// Attach token on every request
apiClient.interceptors.request.use((config) => {
  const isAuthEndpoint = config.url?.includes("/auth/");
  if (!isAuthEndpoint && browserSession.sync())
    throw new AuthSessionChangedError();
  requestRevisions.set(config, authStorage.getRevision());
  const token = authStorage.getToken();

  if (token && !isAuthEndpoint) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshFlight: { revision: number; promise: Promise<AuthResponse> } | null =
  null;

// Bootstrap and 401 retries share one refresh within this tab. Session changes fence late responses.
export const refreshAuthSession = (): Promise<AuthResponse> => {
  try {
    browserSession.sync();
  } catch (error) {
    return Promise.reject(error);
  }
  if (authStorage.isLoggingOut())
    return Promise.reject(new AuthSessionChangedError());
  const revision = authStorage.getRevision();
  if (refreshFlight?.revision === revision) return refreshFlight.promise;
  const promise = browserSession
    .refresh(async () => {
      const { data } = await apiClient.post<AuthResponse>(
        "/auth/refresh",
        undefined,
        { timeout: 20_000 },
      );
      return data;
    })
    .finally(() => {
      if (refreshFlight?.promise === promise) refreshFlight = null;
    });
  refreshFlight = { revision, promise };
  return promise;
};

const refreshAccessToken = async (): Promise<string | null> => {
  const revision = authStorage.getRevision();
  try {
    return (await refreshAuthSession()).token;
  } catch (error) {
    // A temporary connection/server failure is a retryable read failure, not confirmed logout.
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      authStorage.getRevision() === revision
    )
      authStorage.notifyUnauthorized();
    throw error;
  }
};

// Add a response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    if (!response.config.url?.includes("/auth/")) {
      if (
        browserSession.sync() ||
        requestRevisions.get(response.config) !== authStorage.getRevision()
      )
        throw new AuthSessionChangedError();
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url ?? "";
    const isAuthRequest =
      requestPath.includes("/auth/login") ||
      requestPath.includes("/auth/register") ||
      requestPath.includes("/auth/refresh") ||
      requestPath.includes("/auth/logout");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipSessionRefresh &&
      !isAuthRequest &&
      authStorage.hasToken() &&
      !authStorage.isLoggingOut() &&
      requestRevisions.get(originalRequest) === authStorage.getRevision()
    ) {
      originalRequest._retry = true;

      const refreshedToken = await refreshAccessToken();
      if (
        refreshedToken &&
        !authStorage.isLoggingOut() &&
        requestRevisions.get(originalRequest) === authStorage.getRevision()
      ) {
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);
