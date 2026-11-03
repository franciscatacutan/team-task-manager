import type { UserRole } from "./userRole";

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
