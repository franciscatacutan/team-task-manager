import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

import { getProjectInsights } from "../api/projectApi";

export const useProjectInsights = (teamKey: string, projectKey: string) => {
  return useQuery({
    queryKey: queryKeys.projects.insights(teamKey, projectKey),
    queryFn: () => getProjectInsights(teamKey, projectKey),
    enabled: Boolean(teamKey && projectKey),
  });
};
