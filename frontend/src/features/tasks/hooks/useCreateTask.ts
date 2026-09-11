import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types/createTaskSchema";
import { createTask } from "../api/taskApi";

export function useCreateTask(teamKey: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => createTask(teamKey, projectId, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", projectId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", "infinite", teamKey, projectId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectId],
      });
    },
  });
}
