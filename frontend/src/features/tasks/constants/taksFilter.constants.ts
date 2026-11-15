import type { FilterGroup } from "@/common/types/filter.types";
import { TaskStatusLabel } from "../utils/task.constants";
import { TASK_PRIORITY_LABEL, TASK_PRIORITY_ORDER } from "./task.constants";

export const PROJECT_TASK_FILTERS: FilterGroup[] = [
  {
    key: "statusFilter",
    label: "Status",
    type: "multi",
    options: Object.entries(TaskStatusLabel).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    key: "priorityFilter",
    label: "Priority",
    type: "multi",
    options: TASK_PRIORITY_ORDER.map((value) => ({
      value,
      label: TASK_PRIORITY_LABEL[value],
    })),
  },
  {
    key: "overdueFilter",
    label: "Due date",
    type: "single",
    options: [{ value: "true", label: "Overdue only" }],
  },
];
