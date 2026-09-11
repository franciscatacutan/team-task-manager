import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignSupportUser } from "../api/taskApi";

export const useAssignSupportUser = (
  teamKey: string,
  projectId: string,
  taskId: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      assignSupportUser(teamKey, projectId, taskId, userId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectId, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", teamKey, projectId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", "infinite", teamKey, projectId],
      });

      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectId, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectId],
      });
    },
  });
};
