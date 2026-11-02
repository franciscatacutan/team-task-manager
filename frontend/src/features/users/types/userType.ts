import type { UserRole } from "./userRole";

/*
 * User type definition
 */
export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};
