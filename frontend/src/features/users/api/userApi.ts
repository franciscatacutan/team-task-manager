// import type { BaseQueryParams } from "@/common/types/baseQuery.types";
import { apiClient } from "../../../api/apiClients";
import { authStorage } from "../../auth/utils/authStorage";
import type { UserRole } from "../types/userRole";
import type { User } from "../types/userType";
import { jwtDecode } from "jwt-decode";
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

export const getUser = async (userId: string): Promise<User> => {
  const { data } = await apiClient.get<User>(`/users/${userId}`);
  return data;
};

export const updateUserProfile = async (
  userId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
  },
): Promise<User> => {
  const profilePayload = {
    firstName: payload.firstName,
    lastName: payload.lastName,
  };

  const { data: updatedProfile } = await apiClient.patch<User>(
    `/users/${userId}`,
    profilePayload,
  );

  if (payload.email && payload.email !== updatedProfile.email) {
    const { data } = await apiClient.patch<User>(
      `/admin/users/${userId}/email`,
      {
        email: payload.email,
      },
    );
    return data;
  }

  return updatedProfile;
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
