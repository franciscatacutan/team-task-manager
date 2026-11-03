import { queryKeys } from "@/common/query/queryKeys";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getTeams } from "../api/teamApi";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { Team } from "../types/team.type";
import type { PageResponse } from "../../../common/types/pageResponse.types";

export const useTeams = (params: {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
  deletedFilter: DeletedFilter;
  memberId?: string;
}) => {
  return useQuery<PageResponse<Team>>({
    queryKey: queryKeys.teams.list(params),
    queryFn: () =>
      getTeams({
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
        deletedFilter: params.deletedFilter,
        memberId: params.memberId,
      }),
    placeholderData: keepPreviousData,
  });
};
