import { useQuery } from "@tanstack/react-query";

import { getProjectInsights } from "../api/projectApi";

export const useProjectInsights = (teamKey: string, projectId: string) => {
  return useQuery({
    queryKey: ["project-insights", teamKey, projectId],
    queryFn: () => getProjectInsights(teamKey, projectId),
    enabled: Boolean(teamKey && projectId),
  });
};
