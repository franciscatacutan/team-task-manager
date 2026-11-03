import { authStorage } from "../utils/authStorage";
import { apiClient, refreshAuthSession } from "../../../api/apiClients";
import type { AuthResponse } from "../types/auth.types";

export const login = async (payload: { email: string; password: string }) => {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
};

export const register = async (payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) => {
  const { data } = await apiClient.post<AuthResponse>(
    "/auth/register",
    payload,
  );
  return data;
};

export const refresh = refreshAuthSession;

export const logout = async () => {
  const token = authStorage.getToken();
  await apiClient.post("/auth/logout", undefined, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
};
