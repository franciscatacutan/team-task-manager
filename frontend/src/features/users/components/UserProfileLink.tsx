import type { ReactNode } from "react";
import { Link } from "react-router";
import type { UserIdentity } from "../types/userType";

/** A name link is independent from administrative row actions. */
export default function UserProfileLink({
  user,
  enabled,
  children,
}: {
  user: UserIdentity;
  enabled: boolean;
  children?: ReactNode;
}) {
  const name = `${user.firstName} ${user.lastName}`;
  return enabled ? (
    <Link
      to={`/users/${encodeURIComponent(user.id)}`}
      aria-label={`View profile for ${name}`}
      className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children ?? name}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{children ?? name}</span>
  );
}
