import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assignSupportUser } from "../api/taskApi";

export const useAssignSupportUser = (
  teamKey: string,
  projectKey: string,
  taskNumber: string,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      assignSupportUser(teamKey, projectKey, taskNumber, userId),

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
