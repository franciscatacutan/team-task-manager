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
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  isTaskStatus,
  canTransition,
  type TaskStatus,
  TaskStatusLabel,
  TaskStatusStyles,
} from "../utils/task.constants";
import { cn } from "../../../lib/utils";
import { useInfiniteTasks } from "../hooks/useInfiniteTasks";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";

interface Params {
  search?: string;
  status?: TaskStatus;
  sort?: string;
  deletedFilter: DeletedFilter;
}
interface Props {
  teamKey: string;
  projectKey: string;
  params: Params;
  onStatusChange: (taskNumber: string, status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
}

export default function TaskBoard({
  teamKey,
  projectKey,
  params,
  onStatusChange,
  onOpenTask,
}: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
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

    if (task) {
      setActiveTask(task);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = active.data.current?.task as Task | undefined;

    if (!activeTask) return;

    if (isTaskStatus(overId)) {
      const newStatus = overId;

      if (!canTransition(activeTask.status, newStatus)) {
        console.warn("Invalid transition");
        return;
      }

      if (activeTask.status !== newStatus) {
        onStatusChange(activeId, newStatus);
      }
    }
  }

  const commonProps = {
    teamKey,
    projectKey,
    params,
    onOpenTask,
  };
  const statuses: TaskStatus[] =
    params.status && isTaskStatus(params.status)
      ? [params.status]
      : ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD", "DONE", "CANCELLED"];

  return (
    <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
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
  );
}

function BoardColumn({
  id,
  teamKey,
  projectKey,
  params,
  onOpenTask,
}: {
  id: TaskStatus;
  teamKey: string;
  projectKey: string;
  params: Params;
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteTasks(teamKey, projectKey, id, params);

  const tasks = data?.pages.flatMap((page) => page.content) ?? [];

  const total = data?.pages[0]?.totalElements ?? 0;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;

    const isNearBottom =
      el.scrollHeight - el.scrollTop <= el.clientHeight + 100;

    if (isNearBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }

  return (
    <div
      ref={setNodeRef}
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
              <SortableTask key={task.taskNumber} task={task} onOpenTask={onOpenTask} />
            ))}
          </SortableContext>
        )}

        {!isLoading && tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            No tasks in {TaskStatusLabel[id].toLowerCase()}.
          </div>
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
}: {
  task: Task;
  onOpenTask: (task: Task) => void;
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
    data: { task },
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
      style={style}
      className={cn("origin-center", isDragging && "scale-[1.015] opacity-95")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpenTask} />
    </div>
  );
}
