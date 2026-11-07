import { useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { Task } from "../types/task.types";
import type { DeletedFilter } from "@/common/types/deletedFilter.types";
import {
  allowedTransitions,
  canTransition,
  isTaskStatus,
  TaskStatusLabel,
  type TaskStatus,
} from "../utils/task.constants";
import {
  dropStatus,
  statusKeyboardCoordinates,
} from "../utils/taskBoardMovement";
import { useTaskBoardMovement } from "../hooks/useTaskBoardMovement";
import TaskBoardColumn from "./TaskBoardColumn";
import TaskMovementFeedback from "./TaskMovementFeedback";
import TaskCard from "./TaskCard";

export interface TaskBoardParams {
  search?: string;
  status?: TaskStatus[];
  sort?: string;
  deletedFilter: DeletedFilter;
}

const columnCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCorners(args);

export default function TaskBoard({
  isUpdating = false,
  teamKey,
  projectKey,
  params,
  onStatusChange,
  onOpenTask,
  canChangeTaskStatus,
}: {
  isUpdating?: boolean;
  teamKey: string;
  projectKey: string;
  params: TaskBoardParams;
  onStatusChange: (
    taskNumber: number,
    status: TaskStatus,
    checkCurrent?: boolean,
  ) => void | Promise<unknown>;
  onOpenTask: (task: Task) => void;
  canChangeTaskStatus: (task: Task) => boolean;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const handledFocus = useRef(0);
  const statuses = useMemo<TaskStatus[]>(
    () =>
      params.status?.length
        ? [...new Set(params.status.filter(isTaskStatus))]
        : [
            "TODO",
            "IN_PROGRESS",
            "IN_REVIEW",
            "ON_HOLD",
            "DONE",
            "CANCELLED",
            ...(params.deletedFilter !== "ACTIVE" ? ["DELETED" as const] : []),
          ],
    [params.status, params.deletedFilter],
  );
  const canMove = (task: Task) =>
    !isUpdating &&
    canChangeTaskStatus(task) &&
    !task.deletedAt &&
    !task.readOnly &&
    allowedTransitions[task.status].length > 0;
  const movement = useTaskBoardMovement({
    teamKey,
    projectKey,
    boardRef,
    canMove,
    onStatusChange,
  });
  const busy = isUpdating || Boolean(movement.pending);
  const keyboardCoordinates = useMemo(
    () => statusKeyboardCoordinates(statuses),
    [statuses],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  useEffect(() => {
    const job = movement.focus;
    if (
      !job ||
      busy ||
      job.scope !== movement.scope ||
      handledFocus.current === job.id
    )
      return;
    const frame = requestAnimationFrame(() => {
      if (boardRef.current?.dataset.boardScope !== job.scope) return;
      handledFocus.current = job.id;
      if (
        document.activeElement !== document.body &&
        document.activeElement !== job.activator
      )
        return;
      const handle = boardRef.current.querySelector<HTMLButtonElement>(
        `[data-task-handle="${job.taskNumber}"]:not(:disabled)`,
      );
      const open = boardRef.current.querySelector<HTMLButtonElement>(
        `[data-task-open="${job.taskNumber}"]`,
      );
      (handle ?? open)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [movement.focus, movement.scope, busy]);

  return (
    <div
      ref={boardRef}
      data-board-scope={movement.scope}
      className="relative flex h-full min-h-0 flex-col gap-2"
    >
      <div
        aria-busy={busy}
        className="flex h-full min-h-0 gap-4 overflow-x-auto pb-2"
      >
        <DndContext
          key={movement.scope}
          sensors={sensors}
          collisionDetection={columnCollision}
          onDragStart={movement.onDragStart}
          onDragEnd={movement.onDragEnd}
          onDragCancel={movement.onDragCancel}
          accessibility={{
            screenReaderInstructions: {
              draggable:
                "Press Space to pick up a task. Use Left and Right to choose an allowed status column, Space to request the move, or Escape to cancel. Cards stay in the selected sort order.",
            },
            announcements: {
              onDragStart: ({ active }) => {
                const task = active.data.current?.task as Task | undefined;
                return task
                  ? `Picked up task #${task.taskNumber}: ${task.name}. Current status ${TaskStatusLabel[task.status]}.`
                  : undefined;
              },
              onDragOver: ({ active, over }) => {
                const task = active.data.current?.task as Task | undefined;
                const target = dropStatus(over);
                if (!task || !target) return "Outside a status column.";
                return target === task.status
                  ? `Current status ${TaskStatusLabel[target]}.`
                  : canTransition(task.status, target)
                    ? `Move to ${TaskStatusLabel[target]}.`
                    : `Cannot move to ${TaskStatusLabel[target]}.`;
              },
              onDragEnd: ({ active, over }) => {
                const task = active.data.current?.task as Task | undefined;
                const target = dropStatus(over);
                return task &&
                  target &&
                  target !== task.status &&
                  canTransition(task.status, target)
                  ? `Move requested for task #${task.taskNumber} to ${TaskStatusLabel[target]}. Waiting for confirmation.`
                  : "Status unchanged.";
              },
              onDragCancel: () => "Move cancelled. Status unchanged.",
            },
          }}
        >
          {statuses.map((status) => (
            <TaskBoardColumn
              key={status}
              id={status}
              teamKey={teamKey}
              projectKey={projectKey}
              params={params}
              activeTask={movement.activeTask}
              pending={movement.pending}
              busy={busy}
              onOpenTask={onOpenTask}
              canChangeTaskStatus={canMove}
            />
          ))}
          <DragOverlay
            dropAnimation={movement.dropAnimation}
            zIndex={40}
            style={{ pointerEvents: "none" }}
          >
            {movement.activeTask ? (
              <div aria-hidden="true">
                <TaskCard task={movement.activeTask} movementActive />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <TaskMovementFeedback
        feedback={movement.feedback}
        busy={busy}
        onRetry={movement.retry}
        onDismiss={movement.dismiss}
      />
    </div>
  );
}
