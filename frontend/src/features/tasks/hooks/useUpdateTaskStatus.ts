import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTaskStatus } from "../api/taskApi";

import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";

interface Params {
  taskNumber: number;
  status: TaskStatus;
}

interface MutationContext {
  previousTasks?: PageResponse<Task>;
}

export const useUpdateTaskStatus = (teamKey: string, projectKey: string) => {
  const queryClient = useQueryClient();

  const tasksQueryKey = ["tasks", teamKey, projectKey];

  return useMutation({
    mutationFn: ({ taskNumber, status }: Params) =>
      updateTaskStatus(teamKey, projectKey, taskNumber, status),

    onMutate: async ({ taskNumber, status }): Promise<MutationContext> => {
          console.log("TEST2")

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
            task.taskNumber === taskNumber ? { ...task, status } : task,
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
      const { taskNumber } = variables;

      queryClient.invalidateQueries({
        queryKey: tasksQueryKey,
      });

      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey, taskNumber],
      });

      queryClient.invalidateQueries({
        queryKey: ["tasks"],
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
