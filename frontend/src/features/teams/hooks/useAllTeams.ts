import { queryKeys } from "@/common/query/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Team } from "../types/team.type";
import { getAllTeams } from "../api/teamApi";
import type { PageResponse } from "../../../common/types/pageResponse.types";

export const useAllTeams = () => {
  return useQuery<PageResponse<Team>>({
    queryKey: queryKeys.teams.all,

    queryFn: async () =>
      getAllTeams({
        page: 0,
        size: 1000,
        deletedFilter: "ACTIVE",
      }),
    placeholderData: keepPreviousData,
  });
};
