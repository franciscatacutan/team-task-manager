import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import QueryFailure from "@/common/components/QueryFailure";
import { PaginationInfo } from "@/common/components/pagination/PaginationInfo";
import { queryKeys } from "@/common/query/queryKeys";
import { formatDate } from "@/common/utils/dateFormatter";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getMyWork } from "@/features/tasks/api/taskApi";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
} from "@/features/tasks/constants/task.constants";
import type { MyWorkItem } from "@/features/tasks/types/task.types";
import {
  TaskStatusLabel,
  TaskStatusStyles,
} from "@/features/tasks/utils/task.constants";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MyWorkPage() {
  const account = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page"));
  const page =
    Number.isSafeInteger(rawPage) &&
    rawPage >= 0 &&
    rawPage * PAGE_SIZE <= 2_147_483_647
      ? rawPage
      : 0;
  const includeClosed = params.get("closed") === "true";
  const userId = account.data?.id ?? "";
  const work = useQuery({
    queryKey: queryKeys.tasks.myWork(userId, page, includeClosed),
    queryFn: ({ signal }) => getMyWork(page, includeClosed, signal),
    enabled: Boolean(userId),
    refetchOnMount: "always",
    gcTime: 0,
  });
  const { data } = work;
  const lastPage = Math.max(0, (data?.totalPages ?? 1) - 1);

  useEffect(() => {
    if (!data || page <= lastPage) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (lastPage > 0) next.set("page", String(lastPage));
        else next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [data, lastPage, page, setParams]);

  function changePage(nextPage: number) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 0) next.set("page", String(nextPage));
      else next.delete("page");
      return next;
    });
  }

  function toggleClosed(checked: boolean) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      if (checked) next.set("closed", "true");
      else next.delete("closed");
      return next;
    });
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Work</h1>
        <p className="text-sm text-muted-foreground">
          Tasks you’re assigned to or supporting across your teams.
        </p>
      </header>

      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={includeClosed}
          onCheckedChange={(checked) => toggleClosed(checked === true)}
        />
        Include completed and cancelled tasks
      </label>

      {account.isError ? (
        <QueryFailure
          label="your account"
          onRetry={account.refetch}
          pending={account.isFetching}
        />
      ) : work.isError ? (
        <QueryFailure
          label="your work"
          onRetry={work.refetch}
          pending={work.isFetching}
        />
      ) : !data || page > lastPage ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          Loading your work…
        </p>
      ) : data.content.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background p-6 text-sm">
          <p className="font-medium">
            {includeClosed ? "No tasks yet" : "No open tasks"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Tasks appear here when you’re assigned to them or added as support.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-background">
            {data.content.map((task) => (
              <WorkRow
                key={`${task.teamKey}/${task.projectKey}/${task.taskNumber}`}
                task={task}
              />
            ))}
          </ul>
          <nav
            aria-label="My Work pagination"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <PaginationInfo
              page={data.page}
              size={data.size}
              totalElements={data.totalElements}
            />
            {data.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => changePage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.last}
                  onClick={() => changePage(page + 1)}
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

function WorkRow({ task }: { task: MyWorkItem }) {
  const path = `/teams/${task.teamKey}/projects/${task.projectKey}/tasks/${task.taskNumber}`;
  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground wrap-break-word">
          {task.teamName} / {task.projectName}
        </p>
        <Link
          to={path}
          className="rounded-sm font-medium wrap-break-word underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mr-2 text-muted-foreground">#{task.taskNumber}</span>
          {task.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {task.assigned ? "Assigned to you" : "You’re supporting"}
          {task.plannedDueDay && ` · Due ${formatDate(task.plannedDueDay)}`}
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
