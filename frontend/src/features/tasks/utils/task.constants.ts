import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";
import type { SortField } from "@/common/types/sort.types";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "ON_HOLD"
  | "DONE"
  | "CANCELLED"
  | "DELETED";

/*
 Transition rule:
 - Once a task leaves TODO, it cannot go back to TODO
 - DONE can reopen to IN_REVIEW or ON_HOLD; CANCELLED is terminal
 - DELETED is accepted for old records only and is never a transition target
*/

export const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "IN_REVIEW", "ON_HOLD", "DONE", "CANCELLED"],

  IN_PROGRESS: ["IN_REVIEW", "ON_HOLD", "DONE", "CANCELLED"],

  IN_REVIEW: ["IN_PROGRESS", "ON_HOLD", "DONE", "CANCELLED"],

  ON_HOLD: ["IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"],

  DONE: ["IN_REVIEW", "ON_HOLD"],

  CANCELLED: [],
  DELETED: [],
};

export function canTransition(current: TaskStatus, next: TaskStatus) {
  return allowedTransitions[current]?.includes(next);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return [
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "ON_HOLD",
    "DONE",
    "CANCELLED",
    "DELETED",
  ].includes(value);
}

export const TaskStatusLabel: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  ON_HOLD: "On Hold",
  DONE: "Done",
  CANCELLED: "Cancelled",
  DELETED: "Previous status unavailable",
};

export const TaskStatusStyles: Record<TaskStatus, string> = {
  DELETED:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-muted text-muted-foreground",
  TODO: "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-slate-100 text-slate-700 border-slate-200",

  IN_PROGRESS:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-sky-100 text-sky-700 border-sky-200",

  IN_REVIEW:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-violet-100 text-violet-700 border-violet-200",

  ON_HOLD:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-amber-100 text-amber-700 border-amber-200",

  DONE: "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-emerald-100 text-emerald-700 border-emerald-200",

  CANCELLED:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-rose-100 text-rose-700 border-rose-200",
};

export const TASK_LIST_SORT_OPTIONS: { label: string; value: SortField }[] = [
  ...BASE_SORT_OPTIONS,
  { label: "Name", value: "name" },
  { label: "Priority", value: "priority" },
  { label: "Status", value: "status" },
  { label: "Assignee", value: "assignee" },
  { label: "Support", value: "support" },
  { label: "Planned Start Date", value: "plannedStartDate" },
  { label: "Planned Due Date", value: "plannedDueDate" },
];
