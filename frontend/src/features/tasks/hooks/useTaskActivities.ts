import { useQuery, keepPreviousData } from "@tanstack/react-query";

import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { TaskActivity } from "../types/task.types";
import { getTaskActivities } from "../api/taskApi";

interface Params {
  page?: number;
  size?: number;
  sort?: string;
}

export const useTaskActivities = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
  params: Params = {},
) => {
  const { page = 0, size = 10, sort } = params;

  return useQuery<PageResponse<TaskActivity>>({
    queryKey: [
      "taskActivities",
      teamKey,
      projectKey,
      taskNumber,
      page,
      size,
      sort,
    ],

    queryFn: () =>
      getTaskActivities(teamKey, projectKey, taskNumber, {
        page,
        size,
        sort,
      }),

    placeholderData: keepPreviousData,
  });
};
