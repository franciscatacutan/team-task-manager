import type { TaskPriority } from "../../features/tasks/utils/taskPriority";
import { cn } from "../../lib/utils";
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_STYLES,
} from "../../features/tasks/constants/task.constants";

interface Props {
  priority: TaskPriority;
  className?: string;
}

export default function PriorityBadge({ priority, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        TASK_PRIORITY_STYLES[priority],
        className,
      )}
    >
      {TASK_PRIORITY_LABEL[priority]}
    </span>
  );
}
