import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/projectApi";

export const useProject = (teamKey: string, projectKey: string) => {
  return useQuery({
    queryKey: ["project", teamKey, projectKey],
    queryFn: () => getProject(teamKey, projectKey),
  });
};
