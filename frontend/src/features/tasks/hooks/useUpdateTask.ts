import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateTaskInput } from "../types/task.types";
import { updateTask } from "../api/taskApi";

export function useUpdateTask(
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTaskInput) =>
      updateTask(teamKey, projectKey, taskNumber, data),

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
}
