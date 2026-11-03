import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateProjectArchive } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { deleteProject } from "../api/projectApi";

export function useDeleteProject(teamKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.projectArchive(teamKey),
    mutationFn: (projectKey: string) => deleteProject(teamKey, projectKey),

    onSettled: (_data, _error, projectKey) =>
      invalidateProjectArchive(queryClient, teamKey, projectKey),
  });
}
