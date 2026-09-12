import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types/createTaskSchema";
import { createTask } from "../api/taskApi";

export function useCreateTask(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskInput) => createTask(teamKey, projectKey, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks", "infinite", teamKey, projectKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
    },
  });
}
