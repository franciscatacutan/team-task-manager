import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  entity: string;
  canSubmit: boolean;
  error?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  children: ReactNode | ((pending: boolean) => ReactNode);
}

/** One submission lifecycle, accessible feedback and action layout for creation forms. */
export default function CreationForm({
  entity,
  canSubmit,
  error,
  onSubmit,
  onCancel,
  onPendingChange,
  children,
}: Props) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    onPendingChange?.(true);
    try {
      await onSubmit(event);
    } finally {
      inFlight.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <form
      noValidate
      aria-label={`Create ${entity.toLowerCase()}`}
      aria-busy={pending}
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex min-h-0 flex-col"
    >
      <div
        data-slot="creation-form-body"
        className="min-h-0 overflow-y-auto px-6 py-5"
      >
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          {typeof children === "function" ? children(pending) : children}
        </fieldset>
      </div>
      <div className="shrink-0 space-y-3 border-t bg-muted/30 px-6 py-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {pending && (
          <span role="status" className="sr-only">
            Creating {entity.toLowerCase()}...
          </span>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={pending || !canSubmit}>
            {pending && (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            )}
            {pending ? "Creating..." : `Create ${entity}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
