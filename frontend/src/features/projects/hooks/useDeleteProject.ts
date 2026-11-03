import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProject } from "../api/projectApi";

export function useDeleteProject(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectKey: string) => deleteProject(teamKey, projectKey),

    onSuccess: (_, projectKey) => {
      queryClient.invalidateQueries({ queryKey: ["team-insights", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["teamActivity", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["team-audit-logs", teamKey] });
      queryClient.invalidateQueries({
        queryKey: ["project-audit-logs", teamKey, projectKey],
      });
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      queryClient.invalidateQueries({
        queryKey: ["project", teamKey, projectKey],
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({
        queryKey: ["task", teamKey, projectKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["taskActivities", teamKey, projectKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["projectActivity", teamKey, projectKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["project-insights", teamKey, projectKey],
      });
    },
  });
}
