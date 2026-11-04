import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import type { ActivityQueryParams } from "@/common/types/activity.types";
import { getTeamActivities } from "../api/teamApi";

export const useTeamActivities = (
  teamKey: string,
  params: ActivityQueryParams = {},
) => {
  const request = {
    page: params.page ?? 0,
    size: params.size ?? 10,
    search: params.search?.trim() ?? "",
    sort: params.sort ?? "createdAt,desc",
  };
  return useQuery({
    queryKey: queryKeys.teams.activity(teamKey, request),
    queryFn: ({ signal }) => getTeamActivities(teamKey, request, signal),
    enabled: Boolean(teamKey),
  });
};
