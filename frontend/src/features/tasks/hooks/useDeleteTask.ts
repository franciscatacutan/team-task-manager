import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "../api/taskApi";

export function useDeleteTask(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskNumber: number) =>
      deleteTask(teamKey, projectKey, taskNumber),

    onSuccess: (_, taskNumber) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      queryClient.invalidateQueries({ queryKey: ["task", taskNumber] });

      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
    },
  });
}
