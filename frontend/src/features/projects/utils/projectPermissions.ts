import { resolveRoles } from "../../../common/utils/roleHelpers";
import type { NullableTeamRole } from "../../teams/types/team.type";
import type { UserRole } from "../../users/types/userRole";

export interface ProjectPermissions {
  canManageProject: boolean;
  canCreateProject: boolean;
  canEditProjectDetails: boolean;
  canDeleteProject: boolean;
  canViewDeleteProject: boolean;
  canCreateTask: boolean;
  canViewDeleteTask: boolean;
  canChangeProjectStatus: boolean;
}

interface Params {
  globalRole?: UserRole;
  teamRole?: NullableTeamRole;
  isReadOnly?: boolean;
}

export function getProjectPermissions({
  globalRole,
  teamRole,
  isReadOnly = false,
}: Params): ProjectPermissions {
  const { isSuperAdmin, isGlobalAdmin, isOwner, isAdmin } = resolveRoles(
    globalRole,
    teamRole,
  );

  const isSystemAdmin = isSuperAdmin || isGlobalAdmin;
  const canManage = isOwner || isAdmin;
  const canWrite = !isReadOnly;

  return {
    canManageProject: isSystemAdmin || canManage,

    canCreateProject: canWrite && canManage,

    canEditProjectDetails: canWrite && canManage,

    canDeleteProject: canWrite && canManage,

    canViewDeleteProject: isSystemAdmin || canManage,

    canCreateTask: canWrite && canManage,

    canChangeProjectStatus: canWrite && canManage,

    canViewDeleteTask: isSystemAdmin || canManage,
  };
}
