import { useInfiniteQuery } from "@tanstack/react-query";
import { getTeamMembers } from "../api/teamMemberApi";

export function useSelectableTeamMembers(
  teamKey: string,
  search: string,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: ["teamMembers", teamKey, "selector", search],
    queryFn: ({ pageParam, signal }) =>
      getTeamMembers(
        teamKey,
        {
          page: pageParam,
          size: 20,
          search,
          sort: ["user.lastName,asc", "user.email,asc"],
        },
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.last ? undefined : lastPage.page + 1,
    enabled: Boolean(teamKey) && enabled,
  });
}
