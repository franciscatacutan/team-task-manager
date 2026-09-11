import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
    queryKey: [
      "teamActivity",
      teamKey,
      params.page,
      params.size,
      params.search,
      params.sort,
    ],
    queryFn: async () =>
      getTeamActivities(teamKey, {
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
      }),

    placeholderData: keepPreviousData,
  });
};
