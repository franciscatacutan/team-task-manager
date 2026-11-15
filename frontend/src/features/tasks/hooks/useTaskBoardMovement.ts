import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  DragEndEvent,
  DragStartEvent,
  DropAnimation,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useReducedMotion } from "@/common/hooks/useReducedMotion";
import type { Task } from "../types/task.types";
import {
  canTransition,
  TaskStatusLabel,
  type TaskStatus,
} from "../utils/task.constants";
import { dropStatus } from "../utils/taskBoardMovement";
import { taskMutationError } from "../utils/taskMutationError";

interface Attempt {
  id: number;
  scope: string;
  task: Task;
  destination: TaskStatus;
  keyboard: boolean;
  activator: EventTarget | null;
  outcome: Promise<boolean>;
  resolve: (success: boolean) => void;
  animated: boolean;
}
export interface MoveFeedback {
  kind: "pending" | "success" | "error" | "info";
  message: string;
  retry?: { task: Task; destination: TaskStatus };
}
export interface MoveFocus {
  id: number;
  scope: string;
  taskNumber: number;
  activator: EventTarget | null;
}

const paint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function useTaskBoardMovement({
  teamKey,
  projectKey,
  boardRef,
  canMove,
  onStatusChange,
}: {
  teamKey: string;
  projectKey: string;
  boardRef: RefObject<HTMLDivElement | null>;
  canMove: (task: Task) => boolean;
  onStatusChange: (
    taskNumber: number,
    status: TaskStatus,
    checkCurrent?: boolean,
  ) => void | Promise<unknown>;
}) {
  const scope = JSON.stringify([
    teamKey,
    projectKey,
    authStorage.getRevision(),
  ]);
  const scopeRef = useRef(scope);
  const mounted = useRef(true);
  const sequence = useRef(0);
  const operation = useRef<Attempt | null>(null);
  const animation = useRef<Animation | null>(null);
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [feedback, setFeedback] = useState<MoveFeedback | null>(null);
  const [focus, setFocus] = useState<MoveFocus | null>(null);
  const [renderScope, setRenderScope] = useState(scope);
  // Discard the previous workspace/account draft before rendering the new one.
  if (renderScope !== scope) {
    setRenderScope(scope);
    setActiveTask(null);
    setPending(null);
    setFeedback(null);
    setFocus(null);
  }

  const current = (attempt: Attempt) =>
    mounted.current &&
    operation.current === attempt &&
    scopeRef.current === attempt.scope &&
    attempt.scope ===
      JSON.stringify([teamKey, projectKey, authStorage.getRevision()]) &&
    !authStorage.isLoggingOut();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.resolve(false);
      animation.current?.cancel();
    };
  }, []);
  useLayoutEffect(() => {
    scopeRef.current = scope;
    operation.current?.resolve(false);
    operation.current = null;
    animation.current?.cancel();
  }, [scope]);
  useLayoutEffect(() => {
    reducedRef.current = reduced;
    if (reduced) animation.current?.cancel();
  }, [reduced]);
  useEffect(() => {
    if (!feedback || (feedback.kind !== "success" && feedback.kind !== "info"))
      return;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function finish(attempt: Attempt) {
    if (!current(attempt)) return;
    operation.current = null;
    setPending(null);
    if (attempt.keyboard)
      setFocus({
        id: attempt.id,
        scope: attempt.scope,
        taskNumber: attempt.task.taskNumber,
        activator: attempt.activator,
      });
  }

  function move(
    task: Task,
    destination: TaskStatus,
    keyboard: boolean,
    activator: EventTarget | null,
    retry = false,
  ) {
    if (operation.current || !canMove(task)) return;
    let resolve!: (success: boolean) => void;
    const attempt: Attempt = {
      id: ++sequence.current,
      scope,
      task,
      destination,
      keyboard,
      activator,
      outcome: new Promise<boolean>((done) => {
        resolve = done;
      }),
      resolve: (success) => resolve(success),
      animated: false,
    };
    operation.current = attempt;
    setPending(attempt);
    setFocus(null);
    setFeedback({
      kind: "pending",
      message: `Moving task #${task.taskNumber} to ${TaskStatusLabel[destination]}...`,
    });
    void (async () => {
      let success = false;
      try {
        if (retry) await onStatusChange(task.taskNumber, destination, true);
        else await onStatusChange(task.taskNumber, destination);
        success = true;
        if (current(attempt))
          setFeedback({
            kind: "success",
            message: `Task #${task.taskNumber} is now ${TaskStatusLabel[destination]}.`,
          });
      } catch (error) {
        if (current(attempt))
          setFeedback({
            kind: "error",
            message: `Could not confirm moving task #${task.taskNumber} to ${TaskStatusLabel[destination]}. ${taskMutationError(error)}`,
            retry: { task, destination },
          });
      } finally {
        attempt.resolve(success);
        // Retry has no drag overlay. Also cover unmounted/unmeasurable overlays and test DOMs.
        await paint();
        await paint();
        if (!attempt.animated) finish(attempt);
      }
    })();
  }

  function onDragStart(event: DragStartEvent) {
    if (operation.current) return;
    const task = event.active.data.current?.task as Task | undefined;
    if (!task || !canMove(task)) return;
    setFocus(null);
    setFeedback(null);
    setActiveTask(task);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const task = event.active.data.current?.task as Task | undefined;
    const destination = dropStatus(event.over);
    if (!task || !canMove(task) || !destination) return;
    if (destination === task.status) {
      setFeedback({
        kind: "info",
        message: "Status unchanged. Cards stay in the selected sort order.",
      });
      return;
    }
    if (!canTransition(task.status, destination)) {
      setFeedback({
        kind: "error",
        message: `Cannot move from ${TaskStatusLabel[task.status]} to ${TaskStatusLabel[destination]}.`,
      });
      return;
    }
    move(
      task,
      destination,
      event.activatorEvent instanceof KeyboardEvent,
      event.activatorEvent.target,
    );
  }

  const dropAnimation: DropAnimation = async ({
    active,
    dragOverlay,
    transform,
  }) => {
    if (!mounted.current || scopeRef.current !== scope) return;
    const attempt = operation.current;
    if (attempt) {
      attempt.animated = true;
      await attempt.outcome;
      await paint();
      await paint();
      if (!current(attempt)) return;
    }
    let effect: Animation | undefined;
    try {
      if (reducedRef.current || typeof dragOverlay.node.animate !== "function")
        return;
      const number = attempt?.task.taskNumber ?? active.id;
      const target = boardRef.current?.querySelector<HTMLElement>(
        `[data-task-number="${number}"]`,
      );
      const source = dragOverlay.node.getBoundingClientRect();
      const destination = target?.getBoundingClientRect();
      const initial = CSS.Transform.toString(transform);
      const final = destination
        ? CSS.Transform.toString({
            ...transform,
            x: transform.x + destination.left - source.left,
            y: transform.y + destination.top - source.top,
            scaleX:
              (transform.scaleX * destination.width) /
              Math.max(1, source.width),
            scaleY:
              (transform.scaleY * destination.height) /
              Math.max(1, source.height),
          })
        : initial;
      effect = dragOverlay.node.animate(
        [
          { transform: initial, opacity: 1 },
          { transform: final, opacity: destination ? 1 : 0 },
        ],
        { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      animation.current = effect;
      await effect.finished.catch(() => {});
    } finally {
      if (animation.current === effect) animation.current = null;
      if (attempt) finish(attempt);
    }
  };

  return {
    scope,
    activeTask,
    pending,
    feedback,
    focus,
    onDragStart,
    onDragEnd,
    dropAnimation,
    onDragCancel: () => {
      setActiveTask(null);
    },
    dismiss: () => setFeedback(null),
    retry: (activator: EventTarget | null) => {
      if (!feedback?.retry) return;
      move(
        feedback.retry.task,
        feedback.retry.destination,
        true,
        activator,
        true,
      );
    },
  };
}
