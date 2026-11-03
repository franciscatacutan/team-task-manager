import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import type { PageResponse } from "../../../common/types/pageResponse.types";
import { getTasks } from "../api/taskApi";
import type { DeletedFilter } from "../../../common/types/deletedFilter.types";
import type { Task } from "../types/task.types";
import type { TaskStatus } from "../utils/task.constants";

export const useTasks = (
  teamKey: string,
  projectKey: string,
  params: {
    page: number;
    size: number;
    search?: string;
    status?: TaskStatus[];
    sort?: string;
    deletedFilter: DeletedFilter;
  },
  enabled = true,
) => {
  return useQuery<PageResponse<Task>>({
    enabled: Boolean(teamKey && projectKey) && enabled,
    queryKey: queryKeys.tasks.list(teamKey, projectKey, params),

    queryFn: () =>
      getTasks(teamKey, projectKey, {
        page: params.page,
        size: params.size,
        search: params.search,
        status: params.status,
        sort: params.sort,
        deletedFilter: params.deletedFilter,
      }),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.tasks.lists(teamKey, projectKey),
      ),
  });
};
