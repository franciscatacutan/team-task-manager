import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getTeamAuditLogs } from "../api/teamApi";

export const useTeamAuditLogs = (
  teamKey: string,
  params: {
    page?: number;
    size?: number;
    sort?: string;
  },
) => {
  return useQuery({
    queryKey: ["team-audit-logs", teamKey, params.page, params.size, params.sort],
    queryFn: () => getTeamAuditLogs(teamKey, params),
    enabled: Boolean(teamKey),
    placeholderData: keepPreviousData,
  });
};
