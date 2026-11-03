import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "../api/taskApi";

export function useDeleteTask(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskNumber: number) =>
      deleteTask(teamKey, projectKey, taskNumber),

    onSuccess: (_, taskNumber) => {
      queryClient.invalidateQueries({ queryKey: ["team-insights", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["teamActivity", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["team-audit-logs", teamKey] });
      queryClient.invalidateQueries({
        queryKey: ["project-audit-logs", teamKey, projectKey],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey, taskNumber],
      });

      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey, taskNumber],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-insights", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
    },
  });
}
