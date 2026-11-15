import type { User } from "../types/userType";

/** Link affordance only; the profile API remains authoritative for every navigation. */
export function canLinkProfile(
  viewer: Pick<User, "id" | "role"> | undefined,
  subjectId: string,
  sharesConfirmedActiveTeam = false,
) {
  if (!viewer || !subjectId) return false;
  return (
    viewer.id === subjectId ||
    viewer.role === "ADMIN" ||
    viewer.role === "SUPER_ADMIN" ||
    sharesConfirmedActiveTeam
  );
}
