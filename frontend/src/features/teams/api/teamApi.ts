import { apiClient } from "../../../api/apiClients";
import type { BaseQueryParams } from "../../../common/types/baseQuery.types";
import type {
  ObservabilityAuditLog,
  ObservabilitySystemEvent,
} from "../../../common/types/observability.types";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type {
  Team,
  TeamActivity,
  TeamMe,
  TeamMember,
} from "../types/team.type";
import type { TeamInsights } from "../types/teamInsights.types";

export const getTeams = async (
  params: BaseQueryParams & {
    deletedFilter: DeletedFilter;
    memberId?: string;
  },
): Promise<PageResponse<Team>> => {
  const response = await apiClient.get(`/teams`, { params });
  return response.data;
};

export const getAllTeams = async (
  params: Pick<BaseQueryParams, "page" | "size"> & {
    deletedFilter: DeletedFilter;
  },
): Promise<PageResponse<Team>> => {
  const response = await apiClient.get(`/teams`, { params });
  return response.data;
};

export const getTeamActivities = async (
  teamKey: string,
  params: BaseQueryParams,
): Promise<PageResponse<TeamActivity>> => {
  const res = await apiClient.get(`/teams/${teamKey}/activities`, { params });
  return res.data;
};

export const createTeam = async (data: {
  name: string;
  description?: string;
}): Promise<Team> => {
  const response = await apiClient.post("/teams", data);
  return response.data;
};

export const getTeamMe = async (teamKey: string): Promise<TeamMe> => {
  const response = await apiClient.get(`/teams/${teamKey}/me`);
  return response.data;
};

export const getTeam = async (teamKey: string): Promise<Team> => {
  const response = await apiClient.get(`/teams/${teamKey}`);
  return response.data;
};

export const updateTeam = async (
  teamKey: string,
  data: {
    name?: string;
    description?: string;
  },
): Promise<Team> => {
  const response = await apiClient.patch(`/teams/${teamKey}`, data);
  return response.data;
};

export const deleteTeam = async (teamKey: string): Promise<void> => {
  await apiClient.delete(`/teams/${teamKey}`);
};

export const transferTeam = async (
  teamKey: string,
  userId: string,
): Promise<TeamMember> => {
  const response = await apiClient.patch(`/teams/${teamKey}/transfer/${userId}`);
  return response.data;
};

export const getTeamInsights = async (
  teamKey: string,
): Promise<TeamInsights> => {
  const response = await apiClient.get(`/teams/${teamKey}/insights/summary`);
  return response.data;
};

export const getTeamAuditLogs = async (
  teamKey: string,
  params: Pick<BaseQueryParams, "page" | "size" | "sort">,
): Promise<PageResponse<ObservabilityAuditLog>> => {
  const response = await apiClient.get(`/teams/${teamKey}/insights/audit-logs`, {
    params,
  });
  return response.data;
};

export const getTeamSystemEvents = async (
  teamKey: string,
  params: Pick<BaseQueryParams, "page" | "size" | "sort">,
): Promise<PageResponse<ObservabilitySystemEvent>> => {
  const response = await apiClient.get(
    `/teams/${teamKey}/insights/system-events`,
    { params },
  );
  return response.data;
};
