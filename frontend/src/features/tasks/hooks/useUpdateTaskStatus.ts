import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTaskStatus } from "../api/taskApi";

import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";

interface Params {
  taskId: string;
  status: TaskStatus;
}

interface MutationContext {
  previousTasks?: PageResponse<Task>;
}

export const useUpdateTaskStatus = (teamKey: string, projectKey: string) => {
  const queryClient = useQueryClient();

  const tasksQueryKey = ["tasks", teamKey, projectKey];

  return useMutation({
    mutationFn: ({ taskId, status }: Params) =>
      updateTaskStatus(teamKey, projectKey, taskId, status),

    onMutate: async ({ taskId, status }): Promise<MutationContext> => {
      await queryClient.cancelQueries({
        queryKey: tasksQueryKey,
      });

      const previousTasks =
        queryClient.getQueryData<PageResponse<Task>>(tasksQueryKey);

      queryClient.setQueryData<PageResponse<Task>>(tasksQueryKey, (old) => {
        if (!old) return old;

        return {
          ...old,
          content: old.content.map((task) =>
            task.id === taskId ? { ...task, status } : task,
          ),
        };
      });

      return { previousTasks };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(tasksQueryKey, context.previousTasks);
      }
    },

    onSettled: (_, __, variables) => {
      const { taskId } = variables;

      queryClient.invalidateQueries({
        queryKey: tasksQueryKey,
      });

      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey, taskId],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks"],
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
};
