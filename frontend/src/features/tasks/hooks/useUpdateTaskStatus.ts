import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTaskChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { getTask, updateTaskStatus } from "../api/taskApi";
import { authStorage } from "@/features/auth/utils/authStorage";
import { AuthSessionChangedError } from "@/features/auth/utils/sessionCoordinator";
import type { TaskStatus } from "../utils/task.constants";

interface Params {
  taskNumber: number;
  status: TaskStatus;
  checkCurrent?: boolean;
}

export const useUpdateTaskStatus = (teamKey: string, projectKey: string) => {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.taskStatus(teamKey, projectKey),
    mutationFn: async ({ taskNumber, status, checkCurrent }: Params) => {
      if (checkCurrent) {
        const revision = authStorage.getRevision();
        const current = await getTask(teamKey, projectKey, taskNumber);
        if (
          authStorage.getRevision() !== revision ||
          authStorage.isLoggingOut()
        )
          throw new AuthSessionChangedError();
        if (current.status === status) return current;
      }
      return updateTaskStatus(teamKey, projectKey, taskNumber, status);
    },
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
