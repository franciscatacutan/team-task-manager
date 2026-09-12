import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../api/projectApi";

/*
 * Custom hook to create a project.
 */
export const useCreateProject = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      createProject(teamKey, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", teamKey],
      });
    },
  });
};
