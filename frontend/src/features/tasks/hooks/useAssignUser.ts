import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTaskChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { assignUser } from "../api/taskApi";

export const useAssignUser = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.taskAssignee(teamKey, projectKey, taskNumber),
    mutationFn: (userId: string) =>
      assignUser(teamKey, projectKey, taskNumber, userId),

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
};
