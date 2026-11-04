import { useState, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  description: string;
  children: (onPendingChange: (pending: boolean) => void) => ReactNode;
}

/** Shared dialog chrome. A confirmed success closes through the owning module callback. */
export default function CreationDialog({
  open,
  onOpenChange,
  name,
  description,
  children,
}: Props) {
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] transition-none flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
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
        {open && children(setPending)}
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            className="absolute right-2 top-2"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
