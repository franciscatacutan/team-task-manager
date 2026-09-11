import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTaskInput } from "../types/task.types";
import { updateTask } from "../api/taskApi";

export function useUpdateTask(
  teamKey: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTaskInput) =>
      updateTask(teamKey, projectId, taskId, data),

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
}
