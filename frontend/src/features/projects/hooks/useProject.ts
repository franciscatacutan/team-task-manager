import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/projectApi";

export const useProject = (teamKey: string, projectId: string) => {
  return useQuery({
    queryKey: ["project", teamKey, projectId],
    queryFn: () => getProject(teamKey, projectId),
  });
};
