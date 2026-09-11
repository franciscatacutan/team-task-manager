import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getProjectAuditLogs } from "../api/projectApi";

export const useProjectAuditLogs = (
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
      "project-audit-logs",
      teamKey,
      projectId,
      params.page,
      params.size,
      params.sort,
    ],
    queryFn: () => getProjectAuditLogs(teamKey, projectId, params),
    enabled: Boolean(teamKey && projectId),
    placeholderData: keepPreviousData,
  });
};
