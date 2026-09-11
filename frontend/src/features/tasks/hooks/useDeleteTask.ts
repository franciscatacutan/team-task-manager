import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "../api/taskApi";

export function useDeleteTask(teamKey: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(teamKey, projectId, taskId),

    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      queryClient.invalidateQueries({ queryKey: ["task", taskId] });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectId],
      });
    },
  });
}
