import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import { getTasks } from "../api/taskApi";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";

export const useTasks = (
  teamKey: string,
  projectId: string,
  params: {
    page: number;
    size: number;
    search?: string;
    status?: TaskStatus[];
    sort?: string;
    deletedFilter: DeletedFilter;
  },
) => {
  return useQuery<PageResponse<Task>>({
    queryKey: [
      "tasks",
      teamKey,
      projectId,
      params.page,
      params.size,
      params.search,
      params.status,
      params.sort,
      params.deletedFilter,
    ],

    queryFn: () =>
      getTasks(teamKey, projectId, {
        page: params.page,
        size: params.size,
        search: params.search,
        status: params.status,
        sort: params.sort,
        deletedFilter: params.deletedFilter,
      }),
    placeholderData: keepPreviousData,
  });
};
