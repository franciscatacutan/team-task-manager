import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProjectStatus } from "../api/projectApi";
import type { ProjectStatus } from "../types/project.types";

export function useUpdateProjectStatus(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      status,
    }: {
      projectId: string;
      status: ProjectStatus;
    }) => updateProjectStatus(teamKey, projectId, status),

    onSuccess: (project) => {
      queryClient.invalidateQueries({
        queryKey: ["project", teamKey, project.id],
      });

      queryClient.invalidateQueries({
        queryKey: ["projects", teamKey],
      });
    },
  });
}
