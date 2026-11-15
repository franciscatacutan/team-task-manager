import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { hashKey, useQuery } from "@tanstack/react-query";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import { getTasks } from "../api/taskApi";
import type { Task, TaskQueryParams } from "../types/task.types";

export const useTasks = (
  teamKey: string,
  projectKey: string,
  params: TaskQueryParams & { page: number; size: number },
  enabled = true,
) => {
  return useQuery<PageResponse<Task>>({
    enabled: Boolean(teamKey && projectKey) && enabled,
    queryKey: queryKeys.tasks.list(teamKey, projectKey, params),

    queryFn: () => getTasks(teamKey, projectKey, params),
    placeholderData: (data, previous) => {
      const previousParams = previous?.queryKey[3] as
        TaskQueryParams | undefined;
      if (
        !previousParams ||
        hashKey([{ ...params, page: undefined }]) !==
          hashKey([{ ...previousParams, page: undefined }])
      ) {
        return undefined;
      }
      return keepPreviousDataInScope(
        data,
        previous,
        queryKeys.tasks.lists(teamKey, projectKey),
      );
    },
  });
};
