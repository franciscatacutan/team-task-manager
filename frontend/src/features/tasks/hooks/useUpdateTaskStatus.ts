import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTaskChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { updateTaskStatus } from "../api/taskApi";
import type { TaskStatus } from "../utils/task.constants";

interface Params {
  taskNumber: number;
  status: TaskStatus;
}

export const useUpdateTaskStatus = (teamKey: string, projectKey: string) => {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.taskStatus(teamKey, projectKey),
    mutationFn: ({ taskNumber, status }: Params) =>
      updateTaskStatus(teamKey, projectKey, taskNumber, status),
    onSuccess: async (task, variables) => {
      await setConfirmedData(
        queryClient,
        queryKeys.tasks.detail(teamKey, projectKey, variables.taskNumber),
        task,
      );
    },
    onSettled: (_task, _error, variables) =>
      invalidateTaskChange(
        queryClient,
        teamKey,
        projectKey,
        variables.taskNumber,
      ),
  });
};
