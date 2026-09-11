import { Navigate, Outlet, useParams } from "react-router-dom";
import Sidebar from "../../features/teams/components/TeamSidebar";
import { useTeam } from "@/features/teams/hooks/useTeam";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
import WorkspaceError from "./WorkspaceError";
import type { Team } from "@/features/teams/types/team.type";

export interface WorkspaceOutletContext {
  team: Team;
}

export default function WorkspaceLayout() {
  const { teamKey } = useParams();

  const { data: team, isLoading, isError } = useTeam(teamKey ?? "");

  if (!teamKey) {
    return <Navigate to="/teams" replace />;
  }

  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  if (isError || !team) {
    return <WorkspaceError />;
  }

  return (
    <div className="flex h-full w-full min-h-0">
      <Sidebar teamKey={teamKey} team={team} />

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex-1 min-h-0 p-4 sm:p-5 lg:p-6">
          <Outlet context={{ team }} />
        </div>
      </main>
    </div>
  );
}
