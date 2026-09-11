import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getProjectActivities } from "../api/projectApi";

export const useProjectActivity = (
  teamKey: string,
  projectId: string,
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
      projectId,
      params.page,
      params.size,
      params.search,
      params.sort,
    ],
    queryFn: async () =>
      getProjectActivities(teamKey, projectId, {
        page: params.page,
        size: params.size,
        search: params.search,
        sort: params.sort,
      }),

    placeholderData: keepPreviousData,
  });
};
