import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignUser } from "../api/taskApi";

export const useAssignUser = (
  teamKey: string,
  projectKey: string,
  taskNumber: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      assignUser(teamKey, projectKey, taskNumber, userId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey, taskNumber],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", "infinite", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey, taskNumber],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
    },
  });
};
