import { queryKeys } from "@/common/query/queryKeys";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Task, TaskQueryParams } from "../types/task.types";
import { getTasks } from "../api/taskApi";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { TaskStatus } from "../utils/task.constants";

export const useInfiniteTasks = (
  teamKey: string,
  projectKey: string,
  status: TaskStatus,
  filters: Omit<TaskQueryParams, "page" | "size" | "status">,
) => {
  return useInfiniteQuery<PageResponse<Task>>({
    queryKey: queryKeys.tasks.board(teamKey, projectKey, status, filters),

    queryFn: ({ pageParam }) => {
      const page = (pageParam ?? 0) as number;

      return getTasks(teamKey, projectKey, {
        ...filters,
        page,
        size: 10,
        status: [status],
      });
    },

    initialPageParam: 0,

    getNextPageParam: (lastPage) => {
      return lastPage.last ? undefined : lastPage.page + 1;
    },
  });
};
