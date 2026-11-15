import { useActivityFeedState } from "@/common/hooks/useActivityFeedState";
import { useTaskActivities } from "../hooks/useTaskActivities";
import { ActivityFeed } from "../../../common/components/activity/ActivityFeed";
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
  const feed = useActivityFeedState(
    JSON.stringify([teamKey, projectKey, taskNumber]),
  );
  const { data, isPending, isError, isFetching, refetch } = useTaskActivities(
    teamKey,
    projectKey,
    taskNumber,
    feed.params,
  );
  feed.recoverPage(!isError ? data?.totalPages : undefined);

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
            isLoading: isPending || feed.searching,
            isError: isError && !feed.searching,
            isFetching: isFetching || feed.searching,
            onRetry: refetch,
            page: data?.page ?? feed.params.page,
            totalPages: data?.totalPages ?? 0,
            totalElements: data?.totalElements ?? 0,
          }}
          controls={{
            ...feed.controls,
            groupByOptions: [
              { value: "date", label: "Date" },
              { value: "person", label: "Person" },
              { value: "type", label: "Type" },
            ],
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
