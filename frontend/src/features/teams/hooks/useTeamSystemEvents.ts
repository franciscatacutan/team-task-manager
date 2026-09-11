import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getTeamSystemEvents } from "../api/teamApi";

export const useTeamSystemEvents = (
  teamKey: string,
  params: {
    page?: number;
    size?: number;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: [
      "team-system-events",
      teamKey,
      params.page,
      params.size,
      params.sort,
    ],
    queryFn: () => getTeamSystemEvents(teamKey, params),
    enabled: Boolean(teamKey),
    placeholderData: keepPreviousData,
  });
};
