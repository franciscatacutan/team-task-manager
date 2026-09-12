import { useQuery } from "@tanstack/react-query";
import { getTeamMe } from "../api/teamApi";

export function useTeamMe(teamKey: string) {
  return useQuery({
    queryKey: ["team-me", teamKey],
    queryFn: () => getTeamMe(teamKey),
    staleTime: 1000 * 60 * 10,
    enabled: !!teamKey,
  });
}
