import { useInfiniteQuery } from "@tanstack/react-query";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { Task } from "../types/task.types";
import { getTasks } from "../api/taskApi";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import type { TaskStatus } from "../utils/task.constants";

export const useInfiniteTasks = (
  teamKey: string,
  projectKey: string,
  status: TaskStatus,
  params: {
    search?: string;
    status?: TaskStatus;
    sort?: string;
    deletedFilter: DeletedFilter;
  },
) => {
  return useInfiniteQuery<PageResponse<Task>>({
    queryKey: [
      "tasks",
      "infinite",
      teamKey,
      projectKey,
      status,
      params.search,
      params.sort,
      params.deletedFilter,
    ],

    queryFn: ({ pageParam }) => {
      const page = (pageParam ?? 0) as number;

      return getTasks(teamKey, projectKey, {
        page,
        size: 10,
        status: [status],
        search: params.search,
        sort: params.sort,
        deletedFilter: params.deletedFilter,
      });
    },

    initialPageParam: 0,

    getNextPageParam: (lastPage) => {
      return lastPage.last ? undefined : lastPage.page + 1;
    },
  });
};
