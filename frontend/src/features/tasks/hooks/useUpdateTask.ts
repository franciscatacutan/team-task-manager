import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTaskChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import type { UpdateTaskInput } from "../types/task.types";
import { updateTask } from "../api/taskApi";

export function useUpdateTask(
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.taskUpdate(teamKey, projectKey, taskNumber),
    mutationFn: (data: UpdateTaskInput) =>
      updateTask(teamKey, projectKey, taskNumber, data),

    onSuccess: async (task) => {
      await setConfirmedData(
        queryClient,
        queryKeys.tasks.detail(teamKey, projectKey, taskNumber),
        task,
      );
    },
    onSettled: () =>
      invalidateTaskChange(queryClient, teamKey, projectKey, taskNumber),
  });
}
