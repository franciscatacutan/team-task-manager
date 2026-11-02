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

// Attach token on every request
apiClient.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  const isAuthEndpoint = config.url?.includes("/auth/");

  if (token && !isAuthEndpoint) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<AuthResponse>("/auth/refresh")
      .then(({ data }) => {
        authStorage.setToken(data.token);
        return data.token;
      })
      .catch(() => {
        authStorage.clearToken();
        authStorage.notifyUnauthorized();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Add a response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error("API Error:", error);

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
      authStorage.hasToken()
    ) {
      originalRequest._retry = true;

      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);
