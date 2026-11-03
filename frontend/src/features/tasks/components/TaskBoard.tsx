import { Button } from "@/components/ui/button";
import { useState } from "react";

import type { Task } from "../types/task.types";
import TaskCard from "./TaskCard";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  isTaskStatus,
  canTransition,
  allowedTransitions,
  type TaskStatus,
  TaskStatusLabel,
  TaskStatusStyles,
} from "../utils/task.constants";
import { cn } from "../../../lib/utils";
import { useInfiniteTasks } from "../hooks/useInfiniteTasks";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";

interface Params {
  search?: string;
  status?: TaskStatus[];
  sort?: string;
  deletedFilter: DeletedFilter;
}
interface Props {
  teamKey: string;
  projectKey: string;
  params: Params;
  onStatusChange: (taskNumber: number, status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
  canChangeTaskStatus: (task: Task) => boolean;
}

export default function TaskBoard({
  teamKey,
  projectKey,
  params,
  onStatusChange,
  onOpenTask,
  canChangeTaskStatus,
}: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const canMove = (task: Task) =>
    canChangeTaskStatus(task) &&
    !task.deletedAt &&
    !task.readOnly &&
    allowedTransitions[task.status].length > 0;
  const [movementError, setMovementError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dropAnimation = {
    duration: 180,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.45",
        },
      },
    }),
  };

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task;

    if (task && canMove(task)) {
      setMovementError("");
      setActiveTask(task);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveTask(null);

    if (!over) return;

    const task = active.data.current?.task as Task | undefined;
    if (!task || !canMove(task)) return;
    const destination = over.data.current?.status ?? over.id;
    if (
      typeof destination !== "string" ||
      !isTaskStatus(destination) ||
      destination === task.status
    )
      return;
    if (!canTransition(task.status, destination)) {
      setMovementError(
        `Cannot move from ${TaskStatusLabel[task.status]} to ${TaskStatusLabel[destination]}.`,
      );
      return;
    }
    onStatusChange(task.taskNumber, destination);
  }

  const commonProps = {
    teamKey,
    projectKey,
    params,
    onOpenTask,
    canChangeTaskStatus: canMove,
  };
  const statuses: TaskStatus[] = params.status?.length
    ? [...new Set(params.status.filter(isTaskStatus))]
    : [
        "TODO",
        "IN_PROGRESS",
        "IN_REVIEW",
        "ON_HOLD",
        "DONE",
        "CANCELLED",
        ...(params.deletedFilter !== "ACTIVE" ? ["DELETED" as const] : []),
      ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {movementError && (
        <p role="alert" className="text-sm text-destructive">
          {movementError}
        </p>
      )}
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          {statuses.map((status) => (
            <BoardColumn key={status} id={status} {...commonProps} />
          ))}
          <DragOverlay dropAnimation={dropAnimation}>
            {activeTask ? (
              <TaskCard task={activeTask} onOpen={onOpenTask} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function BoardColumn({
  id,
  teamKey,
  projectKey,
  params,
  onOpenTask,
  canChangeTaskStatus,
}: {
  id: TaskStatus;
  teamKey: string;
  projectKey: string;
  params: Params;
  onOpenTask: (task: Task) => void;
  canChangeTaskStatus: (task: Task) => boolean;
}) {
  const { setNodeRef } = useDroppable({
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

  return (
    <div
      ref={setNodeRef}
      data-board-status={id}
      className="flex h-full min-h-0 min-w-74 max-w-88 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-linear-to-b from-muted/35 via-background to-background shadow-sm"
    >
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={TaskStatusStyles[id]}>{TaskStatusLabel[id]}</span>
            <span className="text-xs text-muted-foreground">
              {total} task{total === 1 ? "" : "s"}
            </span>
          </div>
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
          <SortableContext
            items={tasks.map((t) => t.taskNumber)}
            strategy={verticalListSortingStrategy}
          >
            {tasks.map((task) => (
              <SortableTask
                key={task.taskNumber}
                task={task}
                onOpenTask={onOpenTask}
                canChangeTaskStatus={canChangeTaskStatus}
              />
            ))}
          </SortableContext>
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

function SortableTask({
  task,
  onOpenTask,
  canChangeTaskStatus,
}: {
  task: Task;
  onOpenTask: (task: Task) => void;
  canChangeTaskStatus: (task: Task) => boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.taskNumber,
    data: { task, status: task.status },
    disabled: !canChangeTaskStatus(task),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: "transform",
    touchAction: "none" as const,
    zIndex: isDragging ? 20 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      data-task-number={task.taskNumber}
      style={style}
      className={cn("origin-center", isDragging && "scale-[1.015] opacity-95")}
      {...attributes}
      {...listeners}
      aria-label={`Move task #${task.taskNumber}: ${task.name}`}
    >
      <TaskCard task={task} onOpen={onOpenTask} />
    </div>
  );
}
