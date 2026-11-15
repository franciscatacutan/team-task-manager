import type { UserRole } from "./userRole";
import type { PageResponse } from "@/common/types/pageResponse.types";
import type { TeamRole } from "@/features/teams/types/team.type";

export interface AccountTeamAccess {
  key: string;
  name: string;
  role: TeamRole;
  archived: boolean;
}

export interface AccountOpenTask {
  teamKey: string;
  projectKey: string;
  number: number;
  name: string;
  assignee: boolean;
}

export interface AccountAccessReview {
  archivedAt: string | null;
  role: UserRole;
  teams: AccountTeamAccess[];
  openTasks: PageResponse<AccountOpenTask>;
}

export type RestoreUserInput = Pick<AccountAccessReview, "role" | "teams"> & {
  archivedAt: string;
};

export interface UserIdentity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Teammate profiles omit global roles; self/admin responses include them. */
export interface UserProfile extends UserIdentity {
  role?: UserRole;
}
export interface User extends UserIdentity {
  role: UserRole;
  archivedAt?: string;
}
export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
}
export interface AdminUpdateUserInput extends UpdateUserProfileInput {
  email?: string;
  role?: UserRole;
}

export function isFullUser(user: UserProfile): user is User {
  return (
    user.role === "USER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN"
  );
}
