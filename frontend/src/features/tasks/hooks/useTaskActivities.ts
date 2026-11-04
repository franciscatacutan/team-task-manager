import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import type { ActivityQueryParams } from "@/common/types/activity.types";
import { getTaskActivities } from "../api/taskApi";

export const useTaskActivities = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  params: ActivityQueryParams = {},
) => {
  const request = {
    page: params.page ?? 0,
    size: params.size ?? 10,
    search: params.search?.trim() ?? "",
    sort: params.sort ?? "createdAt,desc",
  };
  return useQuery({
    queryKey: queryKeys.tasks.activity(
      teamKey,
      projectKey,
      taskNumber,
      request,
    ),
    queryFn: ({ signal }) =>
      getTaskActivities(teamKey, projectKey, taskNumber, request, signal),
    enabled: Boolean(teamKey && projectKey && taskNumber),
  });
};
