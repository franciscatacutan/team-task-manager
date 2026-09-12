import { apiClient } from "../../../api/apiClients";
import type { BaseQueryParams } from "../../../common/types/baseQuery.types";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type {
  ObservabilityAuditLog,
  ObservabilitySystemEvent,
} from "../../../common/types/observability.types";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { ProjectInsights } from "../types/projectInsights.types";
import type {
  Project,
  ProjectActivity,
  ProjectStatus,
  UpdateProjectInput,
} from "../types/project.types";

export const getProjects = async (
  teamKey: string,
  params: {
    page?: number;
    size?: number;
    search?: string;
    status?: ProjectStatus[];
    all?: boolean;
    sort?: string;
    deletedFilter?: DeletedFilter;
  },
) => {
  const response = await apiClient.get(`/teams/${teamKey}/projects`, {
    params: {
      ...params,
      status: params.status?.length ? params.status : undefined,
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return response.data;
};

export const createProject = async (
  teamKey: string,
  data: { name: string; description?: string },
): Promise<Project> => {
  const response = await apiClient.post(`/teams/${teamKey}/projects`, data);
  return response.data;
};

export const getProject = async (
  teamKey: string,
  projectKey: string,
): Promise<Project> => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}`,
  );

  return response.data;
};

export const getProjectActivities = async (
  teamKey: string,
  projectKey: string,
  params: BaseQueryParams,
): Promise<PageResponse<ProjectActivity>> => {
  const res = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/activities`,
    { params },
  );
  return res.data;
};

export const getProjectInsights = async (
  teamKey: string,
  projectKey: string,
): Promise<ProjectInsights> => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/insights/summary`,
  );
  return response.data;
};

export const getProjectAuditLogs = async (
  teamKey: string,
  projectKey: string,
  params: Pick<BaseQueryParams, "page" | "size" | "sort">,
): Promise<PageResponse<ObservabilityAuditLog>> => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/insights/audit-logs`,
    { params },
  );
  return response.data;
};

export const getProjectSystemEvents = async (
  teamKey: string,
  projectKey: string,
  params: Pick<BaseQueryParams, "page" | "size" | "sort">,
): Promise<PageResponse<ObservabilitySystemEvent>> => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/insights/system-events`,
    { params },
  );
  return response.data;
};

export const updateProject = async (
  teamKey: string,
  projectKey: string,
  data: UpdateProjectInput,
): Promise<Project> => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}`,
    data,
  );
  return response.data;
};

export const updateProjectStatus = async (
  teamKey: string,
  projectKey: string,
  status: ProjectStatus,
): Promise<Project> => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}/status`,
    { status },
  );
  return response.data;
};

export const deleteProject = async (teamKey: string, projectKey: string) => {
  await apiClient.delete(`/teams/${teamKey}/projects/${projectKey}`);
};
