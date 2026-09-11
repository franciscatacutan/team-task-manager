import { keepPreviousData, useQuery } from "@tanstack/react-query";

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
    queryKey: [
      "project-audit-logs",
      teamKey,
      projectKey,
      params.page,
      params.size,
      params.sort,
    ],
    queryFn: () => getProjectAuditLogs(teamKey, projectKey, params),
    enabled: Boolean(teamKey && projectKey),
    placeholderData: keepPreviousData,
  });
};
