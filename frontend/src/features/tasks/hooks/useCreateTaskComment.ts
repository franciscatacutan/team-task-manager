import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTaskComment } from "../api/taskApi";

export const useCreateTaskComment = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      createTaskComment(teamKey, projectKey, taskNumber, message),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey, taskNumber],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivities", teamKey, projectKey],
      });
    },
  });
};
