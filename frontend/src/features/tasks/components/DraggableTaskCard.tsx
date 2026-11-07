import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "../types/task.types";
import TaskCard from "./TaskCard";

export default function DraggableTaskCard({
  task,
  disabled,
  muted,
  movementActive,
  onOpenTask,
}: {
  task: Task;
  disabled: boolean;
  muted: boolean;
  movementActive: boolean;
  onOpenTask: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } =
    useDraggable({
      id: task.taskNumber,
      data: { task, status: task.status },
      disabled,
    });
  return (
    <div
      ref={setNodeRef}
      data-task-number={task.taskNumber}
      onPointerDown={(event) => {
        // Touch keeps native scrolling on the body; its grip owns drag activation.
        if (disabled || event.pointerType !== "mouse") return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const control = target.closest(
          "button, a, input, textarea, select, [contenteditable], [role='button'], [role='link'], [data-no-drag]",
        );
        // The name supports click-to-open and drag-to-move. Other controls stay independent;
        // the grip already has its own pointer/keyboard listeners.
        if (control && !control.hasAttribute("data-task-open")) return;
        listeners?.onPointerDown?.(event);
      }}
      className={cn(
        "motion-safe:transition-opacity motion-safe:duration-150",
        muted && "opacity-35",
        !disabled && "cursor-grab active:cursor-grabbing",
      )}
    >
      <TaskCard
        task={task}
        onOpen={onOpenTask}
        movementActive={movementActive}
        dragHandle={
          <Button
            ref={setActivatorNodeRef}
            data-task-handle={task.taskNumber}
            {...attributes}
            {...listeners}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={`Move task #${task.taskNumber}: ${task.name}`}
            className="touch-none cursor-grab active:cursor-grabbing disabled:cursor-default"
          >
            <GripVertical aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        }
      />
    </div>
  );
}
