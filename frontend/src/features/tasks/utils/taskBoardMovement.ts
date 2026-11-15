import type { KeyboardCoordinateGetter, Over } from "@dnd-kit/core";
import type { Task } from "../types/task.types";
import { canTransition, isTaskStatus, type TaskStatus } from "./task.constants";

export function dropStatus(over: Pick<Over, "id" | "data"> | null) {
  const value: unknown = over?.data.current?.status ?? over?.id;
  return typeof value === "string" && isTaskStatus(value) ? value : undefined;
}

/** Horizontal keys choose allowed columns, never incidental cards or manual positions. */
export function statusKeyboardCoordinates(
  statuses: TaskStatus[],
): KeyboardCoordinateGetter {
  return (event, { currentCoordinates, context }) => {
    if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return;
    const task = context.active?.data.current?.task as Task | undefined;
    const collision = context.collisionRect;
    if (!task || !collision) return;
    const current = dropStatus(context.over) ?? task.status;
    const direction = event.code === "ArrowRight" ? 1 : -1;
    for (
      let index = statuses.indexOf(current) + direction;
      index >= 0 && index < statuses.length;
      index += direction
    ) {
      const status = statuses[index];
      if (status !== task.status && !canTransition(task.status, status))
        continue;
      const container = context.droppableContainers.get(status);
      const rect = context.droppableRects.get(status);
      if (!container || container.disabled || !rect) continue;
      event.preventDefault();
      return {
        x: currentCoordinates.x + rect.left + 12 - collision.left,
        y: currentCoordinates.y + rect.top + 64 - collision.top,
      };
    }
  };
}
