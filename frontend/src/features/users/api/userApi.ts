// import type { BaseQueryParams } from "@/common/types/baseQuery.types";
import { apiClient } from "../../../api/apiClients";
import { authStorage } from "../../auth/utils/authStorage";
import type { UserRole } from "../types/userRole";
import type {
  User,
  UserProfile,
  UpdateUserProfileInput,
  AdminUpdateUserInput,
  AccountAccessReview,
  RestoreUserInput,
} from "../types/userType";
import { jwtDecode } from "jwt-decode";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";
import type { PageResponse } from "@/common/types/pageResponse.types";

/*
 * Fetches the list of users from the backend API.
 */
export const getUsers = async (params: {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  roles?: UserRole[];
  visibility?: DeletedFilter;
}): Promise<PageResponse<User>> => {
  const response = await apiClient.get(`/users`, {
    params: {
      ...params,
      roles: params.roles?.length ? params.roles : undefined,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return response.data;
};

export const getUser = async (userId: string): Promise<UserProfile> => {
  const { data } = await apiClient.get<UserProfile>(`/users/${userId}`);
  return data;
};

/** Self/profile-only operation; email and role never trigger hidden follow-up requests. */
export const updateUserProfile = async (
  userId: string,
  payload: UpdateUserProfileInput,
): Promise<User> => {
  const { data } = await apiClient.patch<User>(`/users/${userId}`, {
    firstName: payload.firstName,
    lastName: payload.lastName,
  });
  return data;
};

export const updateUserByAdmin = async (
  userId: string,
  payload: AdminUpdateUserInput,
): Promise<User> => {
  const { data } = await apiClient.patch<User>(
    `/admin/users/${userId}`,
    payload,
  );
  return data;
};

export const updateUserRole = async (
  userId: string,
  payload: {
    role: UserRole;
  },
): Promise<void> => {
  await apiClient.patch(`/admin/users/${userId}/role`, payload);
};

export const resetUserPasswordByAdmin = async (
  userId: string,
  payload: {
    newPassword: string;
  },
): Promise<void> => {
  await apiClient.patch(`/admin/users/${userId}/password`, payload);
};

export async function getAccountAccessReview(
  userId: string,
  page: number,
  signal: AbortSignal,
) {
  const { data } = await apiClient.get<AccountAccessReview>(
    `/admin/users/${userId}/access-review`,
    {
      params: { page },
      signal,
    },
  );
  return data;
}

export async function changeAccountArchive(
  userId: string,
  review?: RestoreUserInput,
) {
  const { data } = await apiClient.patch<User>(
    `/admin/users/${userId}/${review ? "restore" : "archive"}`,
    review,
  );
  return data;
}

type TokenPayload = {
  role: UserRole;
  exp: number;
  sub: string;
};

export const getUserFromToken = (): TokenPayload | null => {
  const token = authStorage.getToken();
  if (!token) return null;

  try {
    return jwtDecode<TokenPayload>(token);
  } catch {
    return null;
  }
};
