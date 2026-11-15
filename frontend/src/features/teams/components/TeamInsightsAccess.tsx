import { Link, Outlet, useParams } from "react-router";
import QueryFailure from "@/common/components/QueryFailure";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useTeamMe } from "../hooks/useTeamMe";
import { getTeamPermissions } from "../utils/teamPermissions";

/** Mount Insights queries only after the viewer's access has been determined. */
export default function TeamInsightsAccess() {
  const { teamKey = "" } = useParams<{ teamKey: string }>();
  const { user } = useAuth();
  const membership = useTeamMe(teamKey);
  const { canViewInsights } = getTeamPermissions({
    globalRole: user?.role,
    teamRole: membership.isError ? undefined : membership.data?.role,
  });

  if (canViewInsights) return <Outlet />;
  if (membership.isError)
    return (
      <QueryFailure
        label="Insights access"
        onRetry={membership.refetch}
        pending={membership.isFetching}
      />
    );
  if (membership.isPending)
    return <p role="status">Checking Insights access…</p>;

  return (
    <div className="space-y-3 rounded-xl border border-border p-5">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-sm text-muted-foreground">
        Team Insights are available to team owners and admins.
      </p>
      <Button asChild variant="outline">
        <Link to={`/teams/${teamKey}`}>Back to team overview</Link>
      </Button>
    </div>
  );
}
