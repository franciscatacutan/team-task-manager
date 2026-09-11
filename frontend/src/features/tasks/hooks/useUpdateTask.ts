import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTaskInput } from "../types/task.types";
import { updateTask } from "../api/taskApi";

export function useUpdateTask(
  teamKey: string,
  projectKey: string,
  taskId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTaskInput) =>
      updateTask(teamKey, projectKey, taskId, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", "infinite", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
    },
  });
}
