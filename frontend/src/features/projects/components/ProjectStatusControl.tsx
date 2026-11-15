import { useRef, useState } from "react";
import { requestError } from "@/common/utils/requestError";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { projectCompletionWarning } from "../api/projectApi";
import { useUpdateProjectStatus } from "../hooks/useUpdateProjectStatus";
import type { ProjectStatus } from "../types/project.types";
import ProjectStatusSelector from "./ProjectStatusSelector";

interface Props {
  teamKey: string;
  projectKey: string;
  status: ProjectStatus;
}

export default function ProjectStatusControl({
  teamKey,
  projectKey,
  status,
}: Props) {
  const selector = useRef<HTMLButtonElement>(null);
  const [openTaskCount, setOpenTaskCount] = useState<number>();
  const mutation = useUpdateProjectStatus(teamKey);
  const pending = mutation.isPending;
  const showConfirmation =
    openTaskCount !== undefined && status !== "COMPLETED";
  const error =
    mutation.isError && projectCompletionWarning(mutation.error) === undefined
      ? requestError(mutation.error)
      : null;

  function submit(nextStatus: ProjectStatus, confirmedOpenTaskCount?: number) {
    if (pending || nextStatus === status) return;
    mutation.mutate(
      { projectKey, status: nextStatus, confirmedOpenTaskCount },
      {
        onSuccess: () => setOpenTaskCount(undefined),
        onError: (failure) => {
          const latestCount = projectCompletionWarning(failure);
          if (latestCount !== undefined) setOpenTaskCount(latestCount);
        },
      },
    );
  }

  return (
    <>
      <div>
        <ProjectStatusSelector
          value={status}
          disabled={pending}
          triggerRef={selector}
          onChange={submit}
        />
        {pending && !showConfirmation && (
          <p role="status" className="mt-1 text-sm text-muted-foreground">
            Updating status…
          </p>
        )}
        {error && !showConfirmation && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <AlertDialog
        open={showConfirmation}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setOpenTaskCount(undefined);
            mutation.reset();
          }
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            selector.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Complete project?</AlertDialogTitle>
            <AlertDialogDescription aria-live="polite">
              This project has {openTaskCount} open{" "}
              {openTaskCount === 1 ? "task" : "tasks"}. Those tasks will stay
              open, and you can still add or edit tasks after completion.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending} variant="outline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                submit("COMPLETED", openTaskCount);
              }}
            >
              {pending ? "Completing…" : "Complete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
