import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTaskStatus } from "../api/taskApi";
import type { TaskStatus } from "../utils/task.constants";

interface Params {
  taskNumber: number;
  status: TaskStatus;
}

export const useUpdateTaskStatus = (teamKey: string, projectKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskNumber, status }: Params) =>
      updateTaskStatus(teamKey, projectKey, taskNumber, status),
    onSuccess: (task, { taskNumber }) => {
      queryClient.setQueryData(["task", teamKey, projectKey, taskNumber], task);
    },
    // Keep the server authoritative. The old optimistic write targeted a key no list observed.
    onSettled: (_task, _error, { taskNumber }) => {
      for (const queryKey of [
        ["tasks", teamKey, projectKey],
        ["tasks", "infinite", teamKey, projectKey],
        ["task", teamKey, projectKey, taskNumber],
        ["taskActivities", teamKey, projectKey, taskNumber],
        ["projectActivity", teamKey, projectKey],
        ["teamActivity", teamKey],
        ["project-insights", teamKey, projectKey],
        ["team-insights", teamKey],
      ])
        void queryClient.invalidateQueries({ queryKey });
    },
  });
};
