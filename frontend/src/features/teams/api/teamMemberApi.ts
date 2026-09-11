import { apiClient } from "../../../api/apiClients";
import type { BaseQueryParams } from "../../../common/types/baseQuery.types";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { User } from "../../users/types/userType";
import type {
  AddMembersInput,
  RemoveMembersInput,
  TeamMember,
  TeamRole,
} from "../types/team.type";

export const getTeamMembers = async (
  teamKey: string,
  params: BaseQueryParams & {
    roles?: TeamRole[];
  },
): Promise<PageResponse<TeamMember>> => {
  const response = await apiClient.get(`/teams/${teamKey}/members`, {
    params: {
      ...params,
      role: params.roles?.length ? params.roles : undefined,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return response.data;
};

export const getAvailableUsers = async (
  teamKey: string,
  params: Pick<BaseQueryParams, "search" | "size">,
): Promise<PageResponse<User>> => {
  const response = await apiClient.get(`/teams/${teamKey}/available-users`, {
    params,
  });
  return response.data;
};

export const addMembers = async (
  teamKey: string,
  data: AddMembersInput,
): Promise<TeamMember> => {
  const res = await apiClient.post(`/teams/${teamKey}/members`, data);

  return res.data;
};

export const removeMembers = async (
  teamKey: string,
  data: RemoveMembersInput,
): Promise<void> => {
  await apiClient.delete(`/teams/${teamKey}/members`, { data });
};

export const updateMemberRole = async (
  teamKey: string,
  userId: string,
  role: "ADMIN" | "MEMBER",
): Promise<TeamMember> => {
  const res = await apiClient.patch(`/teams/${teamKey}/members/${userId}/role`, {
    role,
  });

  return res.data;
};
