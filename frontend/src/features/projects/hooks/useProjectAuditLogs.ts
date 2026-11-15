import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

import { getProjectAuditLogs } from "../api/projectApi";

export const useProjectAuditLogs = (
  teamKey: string,
  projectKey: string,
  params: {
    page?: number;
    size?: number;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: queryKeys.projects.audit(teamKey, projectKey, params),
    queryFn: () => getProjectAuditLogs(teamKey, projectKey, params),
    enabled: Boolean(teamKey && projectKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(
        data,
        previous,
        queryKeys.projects.audits(teamKey, projectKey),
      ),
  });
};
