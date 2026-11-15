import { isAxiosError } from "axios";
import {
  AuthSessionChangedError,
  browserSession,
} from "@/features/auth/utils/sessionCoordinator";
import { authStorage } from "@/features/auth/utils/authStorage";
import { apiClient, refreshAuthSession } from "@/api/apiClients";

export type UpdateAccountEmailPayload = {
  currentPassword: string;
  newEmail: string;
};
export type UpdatePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export const updateAccountEmail = (
  payload: UpdateAccountEmailPayload,
): Promise<void> =>
  changeCredentials(() =>
    apiClient.patch("/users/me/email", payload, {
      timeout: 20_000,
      skipSessionRefresh: true,
    }),
  );

export const updatePassword = (
  userId: string,
  payload: UpdatePasswordPayload,
): Promise<void> =>
  changeCredentials(() =>
    apiClient.patch(`/users/${userId}/password`, payload, {
      timeout: 20_000,
      skipSessionRefresh: true,
    }),
  );

async function changeCredentials(request: () => Promise<unknown>) {
  const revision = authStorage.getRevision();
  try {
    await browserSession.changeCredentials(request, clearCookie);
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 401) throw error;
    // A 401 confirms the write was rejected. Release the lock before refreshing, then retry once.
    if (browserSession.sync() || revision !== authStorage.getRevision())
      throw new AuthSessionChangedError();
    await refreshAuthSession();
    if (revision !== authStorage.getRevision())
      throw new AuthSessionChangedError();
    await browserSession.changeCredentials(request, clearCookie);
  }
}

async function clearCookie() {
  const token = authStorage.getToken();
  await apiClient.post("/auth/logout", undefined, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    timeout: 20_000,
  });
}
