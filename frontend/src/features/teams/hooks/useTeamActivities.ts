import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getTeamActivities } from "../api/teamApi";

export const useTeamActivities = (
  teamKey: string,
  params: {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: queryKeys.teams.activity(teamKey, params),
    queryFn: async () =>
      getTeamActivities(teamKey, {
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
      }),

    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.teams.activities(teamKey),
      ),
  });
};
