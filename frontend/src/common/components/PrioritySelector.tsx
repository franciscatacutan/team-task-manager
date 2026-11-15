import type { ComponentProps } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

import { cn } from "../../lib/utils";

import {
  type TaskPriority,
  isTaskPriority,
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
  TASK_PRIORITY_ORDER,
} from "../../features/tasks/constants/task.constants";

interface Props extends Pick<
  ComponentProps<typeof SelectTrigger>,
  "id" | "aria-describedby" | "aria-invalid" | "aria-required" | "disabled"
> {
  value?: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  className?: string;
}

export default function PrioritySelect({
  value,
  onChange,
  className,
  disabled,
  ...controlProps
}: Props) {
  return (
    <Select
      disabled={disabled}
      value={value ?? ""}
      onValueChange={(val) => {
        if (!disabled && isTaskPriority(val)) onChange(val);
      }}
    >
      <SelectTrigger
        {...controlProps}
        aria-label="Priority"
        className={cn(
          "h-10 w-full rounded-xl border-border/70 bg-background px-3 text-left text-sm font-medium shadow-none",
          className,
        )}
      >
        <SelectValue placeholder="Select priority">
          {value ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                TASK_PRIORITY_STYLES[value],
              )}
            >
              {TASK_PRIORITY_LABEL[value]}
            </span>
          ) : undefined}
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="rounded-xl border-border/70">
        {TASK_PRIORITY_ORDER.map((priority) => (
          <SelectItem key={priority} value={priority}>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                TASK_PRIORITY_STYLES[priority],
              )}
            >
              {TASK_PRIORITY_LABEL[priority]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
