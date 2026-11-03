import axios from "axios";
import { authStorage } from "../features/auth/utils/authStorage";
import type { AuthResponse } from "../features/auth/types/auth.types";

/*
 * Create an Axios instance with a base URL
 */
const API_URL = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Track the login that sent each request so an old 401 cannot replay work as a new user.
const requestRevisions = new WeakMap<object, number>();

// Attach token on every request
apiClient.interceptors.request.use((config) => {
  requestRevisions.set(config, authStorage.getRevision());
  const token = authStorage.getToken();
  const isAuthEndpoint = config.url?.includes("/auth/");

  if (token && !isAuthEndpoint) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export class AuthSessionChangedError extends Error {
  constructor() {
    super("The authentication session changed during refresh");
  }
}

let refreshFlight: { revision: number; promise: Promise<AuthResponse> } | null =
  null;

// Bootstrap and 401 retries share one refresh within this tab. Session changes fence late responses.
export const refreshAuthSession = (): Promise<AuthResponse> => {
  if (authStorage.isLoggingOut())
    return Promise.reject(new AuthSessionChangedError());
  const revision = authStorage.getRevision();
  if (refreshFlight?.revision === revision) return refreshFlight.promise;
  const promise = apiClient
    .post<AuthResponse>("/auth/refresh")
    .then(({ data }) => {
      if (!authStorage.replaceToken(data.token, revision))
        throw new AuthSessionChangedError();
      return data;
    })
    .catch((error: unknown) => {
      if (authStorage.getRevision() !== revision || authStorage.isLoggingOut())
        throw new AuthSessionChangedError();
      throw error;
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
    if (
      !(error instanceof AuthSessionChangedError) &&
      authStorage.getRevision() === revision
    ) {
      authStorage.clearToken();
      authStorage.notifyUnauthorized();
    }
    return null;
  }
};

// Add a response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
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
