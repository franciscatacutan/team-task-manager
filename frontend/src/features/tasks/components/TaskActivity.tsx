import { useState } from "react";
import { useTaskActivities } from "../hooks/useTaskActivities";
import {
  ActivityFeed,
  type ActivityFeedGroupBy,
} from "../../../common/components/activity/ActivityFeed";
import { cn } from "../../../lib/utils";

interface Props {
  teamKey: string;
  projectKey: string;
  taskNumber: number;
  className?: string;
}

export default function TaskActivity({
  teamKey,
  projectKey,
  taskNumber,
  className,
}: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt,desc");
  const [groupBy, setGroupBy] = useState<ActivityFeedGroupBy>("date");

  const { data, isLoading } = useTaskActivities(teamKey, projectKey, taskNumber, {
    page,
    size: 10,
    sort,
  });

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col gap-3 rounded-2xl border border-border/60 bg-background p-5 shadow-xs",
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">History</h2>
      </div>

      <div className="min-h-0 flex-1">
        <ActivityFeed
          variant="task"
          copy={{
            title: "Task History",
            scopeLabel: "Task history",
            description:
              "A detailed task log of status movement, assignment changes, comments, and edits over time.",
          }}
          data={{
            items: data?.content ?? [],
            isLoading,
            page: data?.page ?? page,
            totalPages: data?.totalPages ?? 0,
            totalElements: data?.totalElements ?? 0,
          }}
          controls={{
            search,
            sort,
            groupBy,
            groupByOptions: [
              { value: "date", label: "Date" },
              { value: "person", label: "Person" },
              { value: "type", label: "Type" },
            ],
            onSearchChange: setSearch,
            onSortChange: (value) => {
              setSort(value);
              setPage(0);
            },
            onGroupByChange: setGroupBy,
            onPageChange: setPage,
          }}
          behavior={{
            interactiveItems: false,
            showHeaderMeta: false,
          }}
        />
      </div>
    </section>
  );
}
