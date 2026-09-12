import { useState } from "react";

import ObservabilityLogs from "../../../common/components/ObservabilityLogs";
import { useProjectAuditLogs } from "../hooks/useProjectAuditLogs";
import { useProjectSystemEvents } from "../hooks/useProjectSystemEvents";

interface Props {
  teamKey: string;
  projectKey: string;
}

const PAGE_SIZE = 10;

export default function ProjectObservabilityLogs({ teamKey, projectKey }: Props) {
  const [auditPage, setAuditPage] = useState(0);
  const [systemPage, setSystemPage] = useState(0);
  const [sort, setSort] = useState("occurredAt,desc");

  const auditLogs = useProjectAuditLogs(teamKey, projectKey, {
    page: auditPage,
    size: PAGE_SIZE,
    sort,
  });
  const systemEvents = useProjectSystemEvents(teamKey, projectKey, {
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
    <ObservabilityLogs
      description="Audit trail and high-signal system events scoped to this project."
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
  );
}
