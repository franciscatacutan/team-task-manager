import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getTeam } from "../api/teamApi";

export const useTeam = (teamKey: string) => {
  return useQuery({
    queryKey: queryKeys.teams.detail(teamKey),
    queryFn: () => getTeam(teamKey),
    staleTime: 60_000,

    enabled: Boolean(teamKey),
  });
};
