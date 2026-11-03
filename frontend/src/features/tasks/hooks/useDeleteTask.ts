import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateTaskChange } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "../api/taskApi";

export function useDeleteTask(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.taskArchive(teamKey, projectKey),
    mutationFn: (taskNumber: number) =>
      deleteTask(teamKey, projectKey, taskNumber),

    onSettled: (_data, _error, taskNumber) =>
      invalidateTaskChange(queryClient, teamKey, projectKey, taskNumber),
  });
}
