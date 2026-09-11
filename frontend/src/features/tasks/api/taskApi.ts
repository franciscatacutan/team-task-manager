import { apiClient } from "./../../../api/apiClients";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { CreateTaskInput } from "../types/createTaskSchema";
import type { Task, TaskActivity, UpdateTaskInput } from "../types/task.types";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { TaskStatus } from "../utils/task.constants";

export const getTasks = async (
  teamKey: string,
  projectId: string,
  params: {
    page?: number;
    size?: number;
    search?: string;
    status?: TaskStatus[];
    sort?: string;
    deletedFilter: DeletedFilter;
  },
) => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectId}/tasks`,
    {
      params: {
        ...params,
        status: params.status?.length ? params.status : undefined,
      },
      paramsSerializer: {
        indexes: null,
      },
    },
  );

  return response.data;
};

export const getTask = async (
  teamKey: string,
  projectId: string,
  taskId: string,
) => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}`,
  );

  return response.data;
};

export const createTask = async (
  teamKey: string,
  projectId: string,
  data: CreateTaskInput,
) => {
  const response = await apiClient.post(
    `/teams/${teamKey}/projects/${projectId}/tasks`,
    data,
  );

  return response.data;
};

export const updateTask = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  data: UpdateTaskInput,
): Promise<Task> => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}`,
    data,
  );

  return response.data;
};

export const deleteTask = async (
  teamKey: string,
  projectId: string,
  taskId: string,
) => {
  await apiClient.delete(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}`,
  );
};

export const getTaskActivities = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  params: { page: number; size: number; sort?: string },
): Promise<PageResponse<TaskActivity>> => {
  const res = await apiClient.get(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}/activities`,
    { params },
  );

  return res.data;
};

export const updateTaskStatus = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  status: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}/status`,
    { status },
  );

  return response.data;
};

export const assignUser = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  userId: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}/assignee/${userId}`,
  );

  return response.data;
};

export const assignSupportUser = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  userId: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}/support/${userId}`,
  );

  return response.data;
};

export const createTaskComment = async (
  teamKey: string,
  projectId: string,
  taskId: string,
  message: string,
) => {
  const response = await apiClient.post(
    `/teams/${teamKey}/projects/${projectId}/tasks/${taskId}/activities`,
    { message },
  );

  return response.data;
};
