import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProjectSystemEvents } from "../api/projectApi";

export const useProjectSystemEvents = (
  teamKey: string,
  projectId: string,
  params: {
    page?: number;
    size?: number;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: [
      "project-system-events",
      teamKey,
      projectId,
      params.page,
      params.size,
      params.sort,
    ],
    queryFn: () => getProjectSystemEvents(teamKey, projectId, params),
    enabled: Boolean(teamKey && projectId),
    placeholderData: keepPreviousData,
  });
};
