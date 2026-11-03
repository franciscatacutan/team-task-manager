import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";
import type { SortField } from "@/common/types/sort.types";
import type { ProjectStatus } from "../types/project.types";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
];

export const ProjectStatusStyles: Record<ProjectStatus, string> = {
  ACTIVE:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-green-100 text-green-700 border-green-200",
  ON_HOLD:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETED:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-blue-100 text-blue-700 border-blue-200",
  DELETED:
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] bg-red-100 text-red-700 border-red-200",
};

export const ProjectStatusLabel: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  DELETED: "Previous status unavailable",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

export const PROJECT_LIST_SORT_OPTIONS: { label: string; value: SortField }[] =
  [
    ...BASE_SORT_OPTIONS,
    { label: "Owner", value: "owner" },
    { label: "Created By", value: "createdBy" },
    { label: "Planned Start Date", value: "plannedStartDate" },
    { label: "Planned Due Date", value: "plannedDueDate" },
  ];
