import { useQuery } from "@tanstack/react-query";

import { getProjectInsights } from "../api/projectApi";

export const useProjectInsights = (teamKey: string, projectKey: string) => {
  return useQuery({
    queryKey: ["project-insights", teamKey, projectKey],
    queryFn: () => getProjectInsights(teamKey, projectKey),
    enabled: Boolean(teamKey && projectKey),
  });
};
