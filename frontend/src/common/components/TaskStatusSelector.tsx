import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  type TaskStatus,
  allowedTransitions,
  canTransition,
  isTaskStatus,
  TaskStatusStyles,
  TaskStatusLabel,
} from "../../features/tasks/utils/task.constants";

import { cn } from "../../lib/utils";

interface Props {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  className?: string;
}

export default function TaskStatusSelector({
  value,
  onChange,
  className,
}: Props) {
  const statuses: TaskStatus[] = [value, ...allowedTransitions[value]];

  return (
    <Select
      value={value}
      disabled={!allowedTransitions[value].length}
      onValueChange={(v) => {
        if (isTaskStatus(v) && canTransition(value, v)) onChange(v);
      }}
    >
      <SelectTrigger
        aria-label="Task status"
        className={cn(
          "h-10 w-full rounded-xl border-border/70 bg-background px-3 text-left text-sm font-medium shadow-none",
          className,
        )}
      >
        <SelectValue>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
              TaskStatusStyles[value],
            )}
          >
            {TaskStatusLabel[value]}
          </span>
        </SelectValue>
      </SelectTrigger>

      <SelectContent className="rounded-xl border-border/70">
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                TaskStatusStyles[status],
              )}
            >
              {TaskStatusLabel[status]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
