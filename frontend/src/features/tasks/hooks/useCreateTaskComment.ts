import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTaskComment } from "../api/taskApi";

export const useCreateTaskComment = (
  teamKey: string,
  projectId: string,
  taskId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) =>
      createTaskComment(teamKey, projectId, taskId, message),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectId, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivities", teamKey, projectId],
      });
    },
  });
};
