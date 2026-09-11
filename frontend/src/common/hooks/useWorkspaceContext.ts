import { useParams } from "react-router-dom";
import { getUserFromToken } from "../../features/users/api/userApi";
import { getTeamPermissions } from "../../features/teams/utils/teamPermissions";
import { useTeamMe } from "../../features/teams/hooks/useTeamMe";
import { useTeam } from "../../features/teams/hooks/useTeam";

export function useWorkspaceContext() {
  const { teamKey, projectId } = useParams();

  const user = getUserFromToken();

  const { data: teamMe } = useTeamMe(teamKey || "");
  const { data: team } = useTeam(teamKey || "");

  const permissions = getTeamPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(team?.deletedAt),
  });

  return {
    teamKey,
    projectId,
    teamIdPresent: !!teamKey,
    projectIdPresent: !!projectId,
    team,
    permissions,
  };
}
