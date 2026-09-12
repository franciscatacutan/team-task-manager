import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
    queryKey: [
      "projectActivities",
      teamKey,
      projectKey,
      params.page,
      params.size,
      params.search,
      params.sort,
    ],
    queryFn: async () =>
      getProjectActivities(teamKey, projectKey, {
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
      }),

    placeholderData: keepPreviousData,
  });
};
