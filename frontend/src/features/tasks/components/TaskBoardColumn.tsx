import { useDroppable } from "@dnd-kit/core";
import { Ban, Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "../types/task.types";
import {
  canTransition,
  TaskStatusLabel,
  TaskStatusStyles,
  type TaskStatus,
} from "../utils/task.constants";
import { useInfiniteTasks } from "../hooks/useInfiniteTasks";
import type { TaskBoardParams } from "./TaskBoard";
import DraggableTaskCard from "./DraggableTaskCard";

export default function TaskBoardColumn({
  id,
  teamKey,
  projectKey,
  params,
  onOpenTask,
  canChangeTaskStatus,
  activeTask,
  pending,
  busy,
}: {
  id: TaskStatus;
  teamKey: string;
  projectKey: string;
  params: TaskBoardParams;
  activeTask: Task | null;
  pending: { task: Task; destination: TaskStatus } | null;
  busy: boolean;
  onOpenTask: (task: Task) => void;
  canChangeTaskStatus: (task: Task) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { status: id },
    disabled: id === "DELETED",
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    isFetchNextPageError,
    refetch,
  } = useInfiniteTasks(teamKey, projectKey, id, params);

  const tasks = data?.pages.flatMap((page) => page.content) ?? [];

  const total = data?.pages[0]?.totalElements ?? 0;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;

    const isNearBottom =
      el.scrollHeight - el.scrollTop <= el.clientHeight + 100;

    if (isNearBottom && hasNextPage && !isFetchingNextPage && !isError) {
      fetchNextPage();
    }
  }

  const allowed =
    activeTask &&
    id !== activeTask.status &&
    canTransition(activeTask.status, id);
  const blocked = activeTask && id !== activeTask.status && !allowed;
  const saving = pending?.destination === id;
  const movementActive = Boolean(activeTask || pending);
  const mutedNumber = activeTask?.taskNumber ?? pending?.task.taskNumber;
  return (
    <div
      ref={setNodeRef}
      data-board-status={id}
      data-drop-state={
        saving
          ? "saving"
          : activeTask
            ? id === activeTask.status
              ? "current"
              : allowed
                ? "allowed"
                : "blocked"
            : "idle"
      }
      className={cn(
        "flex h-full min-h-0 min-w-74 max-w-88 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-linear-to-b from-muted/35 via-background to-background shadow-sm motion-safe:transition-colors motion-safe:duration-150",
        allowed && "border-primary/50",
        isOver && allowed && "ring-2 ring-primary/60",
        isOver && blocked && "border-destructive ring-2 ring-destructive/50",
        saving && "border-primary ring-2 ring-primary/40",
      )}
    >
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={TaskStatusStyles[id]}>{TaskStatusLabel[id]}</span>
            <span className="text-xs text-muted-foreground">
              {total} task{total === 1 ? "" : "s"}
            </span>
          </div>
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
            ) : allowed ? (
              <Check className="h-4 w-4 text-primary" />
            ) : blocked ? (
              <Ban className="h-4 w-4 text-muted-foreground" />
            ) : null}
          </span>
        </div>
      </div>

      <div
        onScroll={handleScroll}
        className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 py-3"
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border border-border/60 bg-muted/25"
              />
            ))}
          </div>
        ) : (
          <>
            {tasks.map((task) => (
              <DraggableTaskCard
                key={task.taskNumber}
                task={task}
                onOpenTask={onOpenTask}
                disabled={busy || !canChangeTaskStatus(task)}
                muted={task.taskNumber === mutedNumber}
                movementActive={movementActive}
              />
            ))}
          </>
        )}

        {isError && (
          <div role="alert" className="space-y-2 p-3 text-sm text-destructive">
            Unable to load tasks.{" "}
            <Button
              variant="outline"
              onClick={() =>
                void (isFetchNextPageError ? fetchNextPage() : refetch())
              }
            >
              Retry tasks
            </Button>
          </div>
        )}
        {!isLoading && !isError && tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            No tasks in {TaskStatusLabel[id].toLowerCase()}.
          </div>
        )}

        {hasNextPage && !isError && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            Load more tasks
          </Button>
        )}
        {isFetchingNextPage && (
          <div className="py-2 text-center text-xs text-muted-foreground">
            Loading more...
          </div>
        )}
      </div>
    </div>
  );
}
