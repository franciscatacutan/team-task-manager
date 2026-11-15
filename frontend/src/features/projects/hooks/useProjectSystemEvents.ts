import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

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
    queryKey: queryKeys.projects.systemEvent(teamKey, projectKey, params),
    queryFn: () => getProjectSystemEvents(teamKey, projectKey, params),
    enabled: Boolean(teamKey && projectKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.projects.systemEvents(teamKey, projectKey),
      ),
  });
};
