import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
  entity: "team" | "project" | "task";
};

/** Consistent page/empty-state creation action; the global menu owns its own trigger. */
export default function CreateButton({ entity, className, ...props }: Props) {
  return (
    <Button
      type="button"
      {...props}
      className={cn("h-11 w-full gap-2 rounded-xl sm:h-9 sm:w-auto", className)}
    >
      <Plus aria-hidden="true" className="h-4 w-4" />
      Create {entity}
    </Button>
  );
}
