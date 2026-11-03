import { keepPreviousDataInScope } from "@/common/query/queryCache";
import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

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
    queryKey: queryKeys.teams.audit(teamKey, params),
    queryFn: () => getTeamAuditLogs(teamKey, params),
    enabled: Boolean(teamKey),
    placeholderData: (data, previous) =>
      keepPreviousDataInScope(data, previous, queryKeys.teams.audits(teamKey)),
  });
};
