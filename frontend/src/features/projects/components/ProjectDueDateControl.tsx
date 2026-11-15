import { useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import DatePicker from "@/common/components/DatePicker";
import FormField from "@/common/components/FormFieldWrapper";
import { useSessionFormSubmission } from "@/common/hooks/useSessionFormSubmission";
import { requestError } from "@/common/utils/requestError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateProject } from "../hooks/useUpdateProject";

interface Props {
  teamKey: string;
  projectKey: string;
  currentDay: string | null;
  startDay?: string | null;
}

export default function ProjectDueDateControl({
  teamKey,
  projectKey,
  currentDay,
  startDay,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const mutation = useUpdateProject(teamKey, projectKey);
  const submission = useSessionFormSubmission();
  const pending = submission.pending || mutation.isPending;
  const dateTooEarly = Boolean(draft && startDay && draft < startDay);

  function changeOpen(next: boolean) {
    if (submission.inFlight.current) return;
    if (next) {
      setDraft(currentDay);
      mutation.reset();
    }
    setOpen(next);
  }

  function changeDraft(value: string | null) {
    if (submission.inFlight.current) return;
    mutation.reset();
    setDraft(value);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft === currentDay || dateTooEarly) return;
    await submission.run(async (isCurrent) => {
      if (!isCurrent()) return;
      try {
        await mutation.mutateAsync({ plannedDueDate: draft });
        if (isCurrent()) setOpen(false);
      } catch {
        // Keep the draft open for retry and show the mutation error.
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="mt-0.5 h-auto px-0 py-1">
          {currentDay ? "Edit due date" : "Set due date"}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeDisabled={pending}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>Project due date</DialogTitle>
          <DialogDescription>
            Choose a due date or leave the project without one.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          aria-busy={pending}
          onSubmit={(event) => {
            void save(event);
          }}
        >
          <fieldset disabled={pending} className="min-w-0 space-y-3">
            <FormField
              label="Due date"
              framed={false}
              error={
                dateTooEarly
                  ? "Choose a date on or after the planned start."
                  : undefined
              }
            >
              {(control) => (
                <DatePicker
                  {...control}
                  value={draft ? parseISO(draft) : undefined}
                  onChange={(date) =>
                    changeDraft(date ? format(date, "yyyy-MM-dd") : null)
                  }
                  placeholder="No due date"
                  triggerDisabled={pending}
                  disabled={
                    startDay
                      ? (date) => format(date, "yyyy-MM-dd") < startDay
                      : undefined
                  }
                />
              )}
            </FormField>
            {draft && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => changeDraft(null)}
              >
                Clear due date
              </Button>
            )}
          </fieldset>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {requestError(mutation.error)}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || dateTooEarly || draft === currentDay}
            >
              {pending ? "Saving…" : "Save due date"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
