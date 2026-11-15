import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/common/query/queryKeys";
import { getProject } from "@/features/projects/api/projectApi";
import { getProjectPermissions } from "@/features/projects/utils/projectPermissions";
import { useParams } from "react-router";
import { getUserFromToken } from "../../features/users/api/userApi";
import { getTeamPermissions } from "../../features/teams/utils/teamPermissions";
import { useTeamMe } from "../../features/teams/hooks/useTeamMe";
import { useTeam } from "../../features/teams/hooks/useTeam";

export function useWorkspaceContext() {
  const { teamKey, projectKey } = useParams();

  const user = getUserFromToken();

  const { data: teamMe } = useTeamMe(teamKey || "");
  const { data: team, isError: teamError } = useTeam(teamKey || "");

  const { data: project, isError: projectError } = useQuery({
    queryKey: queryKeys.projects.detail(teamKey ?? "", projectKey ?? ""),
    queryFn: () => getProject(teamKey!, projectKey!),
    enabled: Boolean(teamKey && projectKey),
  });
  const teamPermissions = getTeamPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(team?.deletedAt),
  });

  const projectPermissions = getProjectPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(
      team?.deletedAt || project?.deletedAt || project?.readOnly,
    ),
  });
  const permissions = {
    ...teamPermissions,
    canCreateProject:
      Boolean(team) && !teamError && teamPermissions.canCreateProject,
    canCreateTask:
      Boolean(team && project) &&
      !teamError &&
      !projectError &&
      projectPermissions.canCreateTask,
  };

  return {
    teamKey,
    projectKey,
    teamKeyPresent: !!teamKey,
    projectKeyPresent: !!projectKey,
    team,
    permissions,
  };
}
