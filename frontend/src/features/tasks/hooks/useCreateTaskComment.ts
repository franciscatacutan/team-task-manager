import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateTaskChange } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { createTaskComment } from "../api/taskApi";

export const useCreateTaskComment = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.taskComment(teamKey, projectKey, taskNumber),
    mutationFn: (message: string) =>
      createTaskComment(teamKey, projectKey, taskNumber, message),

    onSettled: () =>
      invalidateTaskChange(queryClient, teamKey, projectKey, taskNumber),
  });
};
