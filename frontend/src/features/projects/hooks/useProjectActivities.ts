import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getProjectActivities } from "../api/projectApi";

export const useProjectActivity = (
  teamKey: string,
  projectKey: string,
  params: {
    page?: number;
    size?: number;
    search?: string;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: queryKeys.projects.activity(teamKey, projectKey, params),
    queryFn: async () =>
      getProjectActivities(teamKey, projectKey, {
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
      }),

    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.projects.activities(teamKey, projectKey),
      ),
  });
};
