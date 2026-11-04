import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  name: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  children: (onPendingChange: (pending: boolean) => void) => ReactNode;
}

/** Chrome for an open batch editor. Each module owns its selections and partial results. */
export default function MemberBatchDialog({
  name,
  description,
  onOpenChange,
  children,
}: Props) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent
        closeDisabled={pending}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 transition-none sm:max-w-2xl"
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription className="text-foreground/75">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children(setPending)}
      </DialogContent>
    </Dialog>
  );
}
