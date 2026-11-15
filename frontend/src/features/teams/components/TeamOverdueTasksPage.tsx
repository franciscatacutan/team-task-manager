import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import QueryFailure from "@/common/components/QueryFailure";
import { PaginationInfo } from "@/common/components/pagination/PaginationInfo";
import { queryKeys } from "@/common/query/queryKeys";
import { formatDate } from "@/common/utils/dateFormatter";
import { Button } from "@/components/ui/button";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
} from "@/features/tasks/constants/task.constants";
import {
  TaskStatusLabel,
  TaskStatusStyles,
} from "@/features/tasks/utils/task.constants";
import { cn } from "@/lib/utils";
import { getTeamOverdueTasks } from "../api/teamApi";
import type { TeamOverdueTask } from "../types/teamInsights.types";

const PAGE_SIZE = 20;

export default function TeamOverdueTasksPage() {
  const { teamKey = "" } = useParams<{ teamKey: string }>();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page"));
  const page =
    Number.isInteger(rawPage) &&
    rawPage >= 0 &&
    rawPage * PAGE_SIZE <= 2_147_483_647
      ? rawPage
      : 0;
  const overdue = useQuery({
    queryKey: queryKeys.teams.overdueTasks(teamKey, page),
    queryFn: ({ signal }) => getTeamOverdueTasks(teamKey, page, signal),
    enabled: Boolean(teamKey),
    gcTime: 0,
    refetchOnMount: "always",
  });
  const data = overdue.data;
  const lastPage = Math.max(0, (data?.totalPages ?? 1) - 1);

  useEffect(() => {
    if (data && page > lastPage) {
      setParams(lastPage ? { page: String(lastPage) } : {}, { replace: true });
    }
  }, [data, lastPage, page, setParams]);

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/teams/${teamKey}/insights`}>
            <ArrowLeft aria-hidden="true" />
            Back to Team Insights
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Overdue tasks</h1>
        <p className="text-sm text-muted-foreground">
          Open tasks past their due date across this team’s projects.
        </p>
      </header>

      {overdue.isError ? (
        <QueryFailure
          label="overdue tasks"
          onRetry={overdue.refetch}
          pending={overdue.isFetching}
        />
      ) : !data || page > lastPage ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Loading overdue tasks…
        </p>
      ) : data.totalElements === 0 ? (
        <p className="rounded-2xl border border-dashed bg-background p-6 text-sm">
          No overdue tasks.
        </p>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
            {data.content.map((task) => (
              <OverdueTaskRow
                key={`${task.projectKey}/${task.taskNumber}`}
                task={task}
                teamKey={teamKey}
              />
            ))}
          </ul>
          <nav
            aria-label="Overdue tasks pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <PaginationInfo
              page={data.page}
              size={data.size}
              totalElements={data.totalElements}
            />
            {data.totalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() =>
                    setParams(page === 1 ? {} : { page: String(page - 1) })
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.last}
                  onClick={() => setParams({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            )}
          </nav>
        </>
      )}
    </section>
  );
}

function OverdueTaskRow({
  task,
  teamKey,
}: {
  task: TeamOverdueTask;
  teamKey: string;
}) {
  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground wrap-break-word">
          {task.projectName}
        </p>
        <Link
          to={`/teams/${teamKey}/projects/${task.projectKey}/tasks/${task.taskNumber}`}
          className="rounded-sm font-medium wrap-break-word underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mr-2 text-muted-foreground">#{task.taskNumber}</span>
          {task.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          Due {formatDate(task.plannedDueDay)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={TaskStatusStyles[task.status]}>
          {TaskStatusLabel[task.status]}
        </span>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs",
            TASK_PRIORITY_STYLES[task.priority],
          )}
        >
          {TASK_PRIORITY_LABEL[task.priority]}
        </span>
      </div>
    </li>
  );
}
