import { isFullUser, type User, type UserProfile } from "../types/userType";

/** Mirrors the existing backend editing policy; teammate visibility alone never permits edits. */
export function canEditUser(
  viewer: User,
  subject: UserProfile,
): subject is User {
  return (
    isFullUser(subject) &&
    (viewer.id === subject.id ||
      viewer.role === "SUPER_ADMIN" ||
      (viewer.role === "ADMIN" && subject.role !== "SUPER_ADMIN"))
  );
}
