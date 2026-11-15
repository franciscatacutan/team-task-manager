import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

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
    queryKey: queryKeys.teams.systemEvent(teamKey, params),
    queryFn: () => getTeamSystemEvents(teamKey, params),
    enabled: Boolean(teamKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.teams.systemEvents(teamKey),
      ),
  });
};
