import { useState } from "react";

import ObservabilityLogs from "../../../common/components/ObservabilityLogs";
import { useTeamAuditLogs } from "../hooks/useTeamAuditLogs";
import { useTeamSystemEvents } from "../hooks/useTeamSystemEvents";

interface Props {
  teamKey: string;
}

const PAGE_SIZE = 10;

export default function TeamObservabilityLogs({ teamKey }: Props) {
  const [auditPage, setAuditPage] = useState(0);
  const [systemPage, setSystemPage] = useState(0);
  const [sort, setSort] = useState("occurredAt,desc");

  const auditLogs = useTeamAuditLogs(teamKey, {
    page: auditPage,
    size: PAGE_SIZE,
    sort,
  });
  const systemEvents = useTeamSystemEvents(teamKey, {
    page: systemPage,
    size: PAGE_SIZE,
    sort,
  });

  const handleSortChange = (value: string) => {
    setSort(value);
    setAuditPage(0);
    setSystemPage(0);
  };

  return (
    <div className="mb-4">
      <ObservabilityLogs
        description="Audit trail and high-signal system events scoped to this team."
        audit={{
          logs: auditLogs.data?.content ?? [],
          isLoading: auditLogs.isLoading,
          page: auditLogs.data?.page ?? auditPage,
          totalPages: auditLogs.data?.totalPages ?? 0,
          onPageChange: setAuditPage,
        }}
        system={{
          events: systemEvents.data?.content ?? [],
          isLoading: systemEvents.isLoading,
          page: systemEvents.data?.page ?? systemPage,
          totalPages: systemEvents.data?.totalPages ?? 0,
          onPageChange: setSystemPage,
        }}
        sort={sort}
        onSortChange={handleSortChange}
      />
    </div>
  );
}
