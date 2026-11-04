import type { ActivityQueryParams } from "@/common/types/activity.types";
import { apiClient } from "@/api/apiClients";
import type { PageResponse } from "@/common/types/pageResponse.types";
import type { CreateTaskInput } from "../types/createTaskSchema";
import type {
  Task,
  TaskActivity,
  UpdateTaskInput,
  TaskQueryParams,
} from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";

export const getTasks = async (
  teamKey: string,
  projectKey: string,
  params: TaskQueryParams,
): Promise<PageResponse<Task>> => {
  const response = await apiClient.get<PageResponse<Task>>(
    `/teams/${teamKey}/projects/${projectKey}/tasks`,
    {
      params: {
        ...params,
        status: params.status?.length ? params.status : undefined,
        priority: params.priority?.length ? params.priority : undefined,
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
  signal?: AbortSignal,
): Promise<Task> => {
  const response = await apiClient.get<Task>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
    { signal },
  );

  return response.data;
};

export const createTask = async (
  teamKey: string,
  projectKey: string,
  data: CreateTaskInput,
): Promise<Task> => {
  const response = await apiClient.post<Task>(
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
  const response = await apiClient.patch<Task>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
    data,
  );

  return response.data;
};

export const deleteTask = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
): Promise<void> => {
  await apiClient.delete(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}`,
  );
};

export const getTaskActivities = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  params: ActivityQueryParams,
  signal?: AbortSignal,
): Promise<PageResponse<TaskActivity>> => {
  const res = await apiClient.get<PageResponse<TaskActivity>>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/activities`,
    { params, signal },
  );

  return res.data;
};

export const updateTaskStatus = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  status: TaskStatus,
): Promise<Task> => {
  const response = await apiClient.patch<Task>(
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
): Promise<Task> => {
  const response = await apiClient.patch<Task>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/assignee/${userId}`,
  );

  return response.data;
};

export const assignSupportUser = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  userId: string | null,
): Promise<Task> => {
  if (userId === null) {
    const response = await apiClient.delete<Task>(
      `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/support`,
    );
    return response.data;
  }
  const response = await apiClient.patch<Task>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/support/${userId}`,
  );

  return response.data;
};

export const createTaskComment = async (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  message: string,
): Promise<TaskActivity> => {
  const response = await apiClient.post<TaskActivity>(
    `/teams/${teamKey}/projects/${projectKey}/tasks/${taskNumber}/activities`,
    { message },
  );

  return response.data;
};
