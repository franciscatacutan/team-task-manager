import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProjectStatus } from "../api/projectApi";
import type { ProjectStatus } from "../types/project.types";

export function useUpdateProjectStatus(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectKey,
      status,
    }: {
      projectKey: string;
      status: ProjectStatus;
    }) => updateProjectStatus(teamKey, projectKey, status),

    onSuccess: (project) => {
      queryClient.invalidateQueries({
        queryKey: ["project", teamKey, project.key],
      });

      queryClient.invalidateQueries({
        queryKey: ["projects", teamKey],
      });
    },
  });
}
