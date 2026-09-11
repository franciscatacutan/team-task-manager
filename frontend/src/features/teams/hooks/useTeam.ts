import { useQuery } from "@tanstack/react-query";
import { getTeam } from "../api/teamApi";

export const useTeam = (teamKey: string) => {
  return useQuery({
    queryKey: ["team", teamKey],
    queryFn: () => getTeam(teamKey),
    staleTime: 60_000,

    enabled: Boolean(teamKey),
  });
};
