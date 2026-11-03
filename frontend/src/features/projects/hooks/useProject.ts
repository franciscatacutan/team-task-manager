import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/projectApi";

export const useProject = (teamKey: string, projectKey: string) => {
  return useQuery({
    queryKey: queryKeys.projects.detail(teamKey, projectKey),
    queryFn: () => getProject(teamKey, projectKey),
  });
};
