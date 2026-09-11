import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTaskComment } from "../api/taskApi";

export const useCreateTaskComment = (
  teamKey: string,
  projectKey: string,
  taskId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      createTaskComment(teamKey, projectKey, taskId, message),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivities", teamKey, projectKey],
      });
    },
  });
};
