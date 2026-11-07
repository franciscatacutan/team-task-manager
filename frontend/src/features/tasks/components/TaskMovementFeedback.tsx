import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MoveFeedback } from "../hooks/useTaskBoardMovement";
import { TaskStatusLabel } from "../utils/task.constants";

export default function TaskMovementFeedback({
  feedback,
  busy,
  onRetry,
  onDismiss,
}: {
  feedback: MoveFeedback | null;
  busy: boolean;
  onRetry: (activator: EventTarget | null) => void;
  onDismiss: () => void;
}) {
  if (!feedback) return null;
  return (
    <div
      data-task-movement-feedback
      className={cn(
        "fixed bottom-4 right-4 z-30 flex max-w-[min(30rem,calc(100vw-2rem))] items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150",
        feedback.kind === "error" ? "border-destructive/50" : "border-border",
      )}
    >
      {feedback.kind === "pending" && (
        <LoaderCircle
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
      )}
      <p
        role={feedback.kind === "error" ? "alert" : "status"}
        aria-atomic="true"
        className={cn(
          "min-w-0 text-sm",
          feedback.kind === "error" && "text-destructive",
        )}
      >
        {feedback.message}
      </p>
      {feedback.retry && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          aria-label={`Retry moving task #${feedback.retry.task.taskNumber} to ${TaskStatusLabel[feedback.retry.destination]}`}
          onClick={(event) => onRetry(event.currentTarget)}
        >
          Retry
        </Button>
      )}
      {feedback.kind !== "pending" && (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss movement feedback"
          onClick={onDismiss}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
