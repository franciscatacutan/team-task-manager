import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProject } from "../api/projectApi";

export function useDeleteProject(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(teamKey, projectId),

    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
