import { useQuery } from "@tanstack/react-query";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import { getTeamMembers } from "../api/teamMemberApi";
import type { TeamMember } from "../types/team.type";

interface Params {
  search?: string;
}

export const useAllTeamMembers = (teamKey: string, params?: Params) => {
  return useQuery<PageResponse<TeamMember>>({
    queryKey: ["allTeamMembers", teamKey, params?.search],
    queryFn: () =>
      getTeamMembers(teamKey, {
        page: 0,
        size: 1000,
        search: params?.search,
        sort: "joinedAt,desc",
      }),
    staleTime: 1000 * 60 * 5,
  });
};
