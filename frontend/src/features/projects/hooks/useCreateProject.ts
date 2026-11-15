import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateProjectChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { createProject } from "../api/projectApi";
import type { CreateProjectInput } from "../types/createProjectSchema";

/*
 * Custom hook to create a project.
 */
export const useCreateProject = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.projectCreate(teamKey),
    mutationFn: (data: CreateProjectInput) => createProject(teamKey, data),

    onSuccess: async (project) => {
      await setConfirmedData(
        queryClient,
        queryKeys.projects.detail(teamKey, project.key),
        project,
      );
    },
    onSettled: (project) =>
      invalidateProjectChange(queryClient, teamKey, project?.key),
  });
};
