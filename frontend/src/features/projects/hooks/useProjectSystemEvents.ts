import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProjectSystemEvents } from "../api/projectApi";

export const useProjectSystemEvents = (
  teamKey: string,
  projectKey: string,
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
      projectKey,
      params.page,
      params.size,
      params.sort,
    ],
    queryFn: () => getProjectSystemEvents(teamKey, projectKey, params),
    enabled: Boolean(teamKey && projectKey),
    placeholderData: keepPreviousData,
  });
};
