import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateProjectChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

import { updateProjectStatus } from "../api/projectApi";
import type { ProjectStatus } from "../types/project.types";

export function useUpdateProjectStatus(teamKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.projectStatus(teamKey),
    mutationFn: ({
      projectKey,
      status,
    }: {
      projectKey: string;
      status: ProjectStatus;
    }) => updateProjectStatus(teamKey, projectKey, status),

    onSuccess: async (project, { projectKey }) => {
      await setConfirmedData(
        queryClient,
        queryKeys.projects.detail(teamKey, projectKey),
        project,
      );
    },
    onSettled: (_project, _error, { projectKey }) =>
      invalidateProjectChange(queryClient, teamKey, projectKey),
  });
}
