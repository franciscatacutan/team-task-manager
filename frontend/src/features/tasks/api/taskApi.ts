import { apiClient } from "./../../../api/apiClients";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { CreateTaskInput } from "../types/createTaskSchema";
import type { Task, TaskActivity, UpdateTaskInput } from "../types/task.types";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { TaskStatus } from "../utils/task.constants";

export const getTasks = async (
  teamKey: string,
  projectKey: string,
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
    `/teams/${teamKey}/projects/${projectKey}/tasks`,
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
  projectKey: string,
  taskNumber: number,
) => {
  const response = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
  );

  return response.data;
};

export const createTask = async (
  teamKey: string,
  projectKey: string,
  data: CreateTaskInput,
) => {
  const response = await apiClient.post(
    `/teams/${teamKey}/projects/${projectKey}/tasks`,
    data,
  );

  return response.data;
};

export const updateTask = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  data: UpdateTaskInput,
): Promise<Task> => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
    data,
  );

  return response.data;
};

export const deleteTask = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) => {
  await apiClient.delete(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
  );
};

export const getTaskActivities = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  params: { page: number; size: number; sort?: string },
): Promise<PageResponse<TaskActivity>> => {
  const res = await apiClient.get(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/activities`,
    { params },
  );

  return res.data;
};

export const updateTaskStatus = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  status: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/status`,
    { status },
  );

  return response.data;
};

export const assignUser = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  userId: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/assignee/${userId}`,
  );

  return response.data;
};

export const assignSupportUser = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  userId: string,
) => {
  const response = await apiClient.patch(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/support/${userId}`,
  );

  return response.data;
};

export const createTaskComment = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  message: string,
) => {
  const response = await apiClient.post(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/activities`,
    { message },
  );

  return response.data;
};
