import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateProjectChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import type { UpdateProjectInput } from "../types/project.types";
import { updateProject } from "../api/projectApi";

export function useUpdateProject(teamKey: string, projectKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.projectUpdate(teamKey, projectKey),
    mutationFn: (data: UpdateProjectInput) =>
      updateProject(teamKey, projectKey, data),

    onSuccess: async (project) => {
      await setConfirmedData(
        queryClient,
        queryKeys.projects.detail(teamKey, projectKey),
        project,
      );
    },
    onSettled: () => invalidateProjectChange(queryClient, teamKey, projectKey),
  });
}
