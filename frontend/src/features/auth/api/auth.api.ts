import { browserSession } from "../utils/sessionCoordinator";
import { authStorage } from "../utils/authStorage";
import { apiClient, refreshAuthSession } from "../../../api/apiClients";
import type { AuthResponse } from "../types/auth.types";

export const login = async (payload: { email: string; password: string }) => {
  return browserSession.authenticate(async () => {
    const { data } = await apiClient.post<AuthResponse>(
      "/auth/login",
      payload,
      { timeout: 20_000 },
    );
    return data;
  });
};

export const register = async (payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) => {
  return browserSession.authenticate(async () => {
    const { data } = await apiClient.post<AuthResponse>(
      "/auth/register",
      payload,
      { timeout: 20_000 },
    );
    return data;
  });
};

export const refresh = refreshAuthSession;

export const logout = async () => {
  const token = authStorage.getToken();
  await browserSession.logout(() =>
    apiClient.post("/auth/logout", undefined, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      timeout: 20_000,
    }),
  );
};
