import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateProjectInput } from "../types/project.types";
import { updateProject } from "../api/projectApi";

export function useUpdateProject(teamKey: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProjectInput) =>
      updateProject(teamKey, projectId, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project", teamKey, projectId],
      });

      queryClient.invalidateQueries({
        queryKey: ["projects", teamKey],
      });
    },
  });
}
