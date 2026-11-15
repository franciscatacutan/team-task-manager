import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTaskChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types/createTaskSchema";
import { createTask } from "../api/taskApi";

export function useCreateTask(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.taskCreate(teamKey, projectKey),
    mutationFn: (data: CreateTaskInput) =>
      createTask(teamKey, projectKey, data),

    onSuccess: async (task) => {
      await setConfirmedData(
        queryClient,
        queryKeys.tasks.detail(teamKey, projectKey, task.taskNumber),
        task,
      );
    },
    onSettled: (task) =>
      invalidateTaskChange(queryClient, teamKey, projectKey, task?.taskNumber),
  });
}
