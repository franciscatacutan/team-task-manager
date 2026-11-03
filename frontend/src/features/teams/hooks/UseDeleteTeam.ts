import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTeam } from "../api/teamApi";

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamKey: string) => deleteTeam(teamKey),

    onSuccess: (_, teamKey) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });

      queryClient.invalidateQueries({ queryKey: ["team", teamKey] });
      for (const key of [
        "projects",
        "project",
        "tasks",
        "task",
        "taskActivities",
        "teamActivity",
        "projectActivity",
        "project-insights",
        "team-insights",
        "team-audit-logs",
        "project-audit-logs",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}
