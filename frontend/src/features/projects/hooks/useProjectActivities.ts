import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import type { ActivityQueryParams } from "@/common/types/activity.types";
import { getProjectActivities } from "../api/projectApi";

export const useProjectActivity = (
  teamKey: string,
  projectKey: string,
  params: ActivityQueryParams = {},
) => {
  const request = {
    page: params.page ?? 0,
    size: params.size ?? 10,
    search: params.search?.trim() ?? "",
    sort: params.sort ?? "createdAt,desc",
  };
  return useQuery({
    queryKey: queryKeys.projects.activity(teamKey, projectKey, request),
    queryFn: ({ signal }) =>
      getProjectActivities(teamKey, projectKey, request, signal),
    enabled: Boolean(teamKey && projectKey),
  });
};
