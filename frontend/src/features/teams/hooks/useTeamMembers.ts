import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import { getTeamMembers } from "../api/teamMemberApi";
import type { TeamMember, TeamRole } from "../types/team.type";

interface Params {
  page: number;
  size?: number;
  search?: string;
  sort?: string;
  roles?: TeamRole[];
}

export const useTeamMembers = (teamKey: string, params?: Params) => {
  return useQuery<PageResponse<TeamMember>>({
    queryKey: queryKeys.teams.memberList(teamKey, params ?? {}),
    queryFn: () =>
      getTeamMembers(teamKey, {
        page: params?.page,
        size: params?.size,
        search: params?.search,
        sort: params?.sort,
        roles: params?.roles,
      }),
    enabled: Boolean(teamKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(data, previous, queryKeys.teams.members(teamKey)),
  });
};
