import { apiClient } from "../../../api/apiClients";
import type { BaseQueryParams } from "../../../common/types/baseQuery.types";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { UserIdentity } from "../../users/types/userType";
import type {
  AddMembersInput,
  AddMembersResult,
  RemoveMembersResult,
  RemoveMembersInput,
  TeamMember,
  TeamRole,
} from "../types/team.type";

export const getTeamMembers = async (
  teamKey: string,
  params: Omit<BaseQueryParams, "sort"> & {
    sort?: string | string[];
    roles?: TeamRole[];
  },
  signal?: AbortSignal,
): Promise<PageResponse<TeamMember>> => {
  const response = await apiClient.get<PageResponse<TeamMember>>(
    `/teams/${teamKey}/members`,
    {
      signal,
      params: {
        ...params,
        role: params.roles?.length ? params.roles : undefined,
      },
      paramsSerializer: {
        indexes: null,
      },
    },
  );
  return response.data;
};

export const getAvailableUsers = async (
  teamKey: string,
  params: Pick<BaseQueryParams, "search" | "size">,
): Promise<PageResponse<UserIdentity>> => {
  const response = await apiClient.get(`/teams/${teamKey}/available-users`, {
    params,
  });
  return response.data;
};

export const addMembers = async (
  teamKey: string,
  data: AddMembersInput,
): Promise<AddMembersResult> => {
  const res = await apiClient.post<AddMembersResult>(
    `/teams/${teamKey}/members`,
    data,
  );

  return res.data;
};

export const removeMembers = async (
  teamKey: string,
  data: RemoveMembersInput,
): Promise<RemoveMembersResult> => {
  const response = await apiClient.delete<RemoveMembersResult>(
    `/teams/${teamKey}/members`,
    { data },
  );
  return response.data;
};

export const updateMemberRole = async (
  teamKey: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<TeamMember> => {
  const res = await apiClient.patch(
    `/teams/${teamKey}/members/${userId}/role`,
    {
      role,
    },
  );

  return res.data;
};
