import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";
import type { SortField } from "@/common/types/sort.types";
import type { TeamRole } from "../types/team.type";

export const TeamRoleOrder: TeamRole[] = ["OWNER", "ADMIN", "MEMBER"];

export const TEAM_ROLE_STYLES: Record<TeamRole, string> = {
  OWNER:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300",
  ADMIN:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300",
  MEMBER: "bg-muted text-foreground/75 border-border",
};

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export const TEAM_LIST_SORT_OPTIONS: { label: string; value: SortField }[] = [
  ...BASE_SORT_OPTIONS,
  { label: "Owner", value: "owner" },
];
