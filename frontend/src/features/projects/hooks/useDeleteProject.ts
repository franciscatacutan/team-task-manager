import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteProject } from "../api/projectApi";

export function useDeleteProject(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectKey: string) => deleteProject(teamKey, projectKey),

    onSuccess: (_, projectKey) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });

      queryClient.invalidateQueries({ queryKey: ["project", projectKey] });
    },
  });
}
