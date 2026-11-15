import type { SortField } from "@/common/types/sort.types";
import type { UserRole } from "../types/userRole";
import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";

export const USER_ROLES: UserRole[] = ["USER", "ADMIN", "SUPER_ADMIN"];

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  USER: "User",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export const USER_ROLE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300",
  ADMIN:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300",
  USER: "bg-muted text-foreground/75 border-border",
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export const UserRoleOrder: UserRole[] = ["SUPER_ADMIN", "ADMIN", "USER"];

export const USER_LIST_SORT_OPTIONS: { label: string; value: SortField }[] = [
  ...BASE_SORT_OPTIONS,
  { label: "Role", value: "role" },
];
