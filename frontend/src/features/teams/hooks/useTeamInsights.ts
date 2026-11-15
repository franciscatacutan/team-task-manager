import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getTeamInsights } from "../api/teamApi";

export const useTeamInsights = (teamKey: string) => {
  return useQuery({
    queryKey: queryKeys.teams.insights(teamKey),
    queryFn: () => getTeamInsights(teamKey),
    enabled: Boolean(teamKey),
  });
};
