import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
    queryKey: [
      "teamMembers",
      teamKey,
      params?.page,
      params?.size,
      params?.search,
      params?.sort,
      params?.roles,
    ],
    queryFn: () =>
      getTeamMembers(teamKey, {
        page: params?.page,
        size: params?.size,
        search: params?.search,
        sort: params?.sort,
        roles: params?.roles,
      }),
    enabled: Boolean(teamKey),
    placeholderData: keepPreviousData,
  });
};
