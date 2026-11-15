import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export interface SortOption<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  field: T;
  order: "asc" | "desc";
  options: SortOption<T>[];

  onFieldChange: (field: T) => void;
  onToggleOrder: () => void;
}

export function SortControl<T extends string>({
  field,
  order,
  options,
  onFieldChange,
  onToggleOrder,
}: Props<T>) {
  const [open, setOpen] = useState(false);

  const active = options.find((o) => o.value === field);

  function handleSelect(value: T) {
    onFieldChange(value);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex h-10 rounded-xl border border-border/70 bg-background shadow-sm hover:shadow-md transition overflow-hidden">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="flex-1 h-full px-4 rounded-none border-r border-border/60 hover:bg-muted/50"
          >
            <span className="text-sm font-medium">
              {active?.label ?? "Sort"}
            </span>
          </Button>
        </PopoverTrigger>

        <Button
          type="button"
          variant="ghost"
          aria-label={order === "asc" ? "Sort descending" : "Sort ascending"}
          onClick={onToggleOrder}
          className="h-full px-3 rounded-none border-r border-border/60 hover:bg-muted/50"
        >
          <span className="text-sm leading-none">
            {order === "asc" ? "↑" : "↓"}
          </span>
        </Button>
      </div>

      <PopoverContent align="start" className="w-36 p-2">
        <div className="px-2 py-1 text-xs text-muted-foreground">Sort by</div>

        {options.map((opt) => {
          const isActive = field === opt.value;

          return (
            <Button
              key={opt.value}
              variant="ghost"
              onClick={() => handleSelect(opt.value)}
              className={`w-full justify-between px-3 py-2 rounded-lg text-sm ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/50"
              }`}
            >
              {opt.label}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
