import { resolveRoles } from "../../../common/utils/roleHelpers";
import type { UserRole } from "../../users/types/userRole";
import type { NullableTeamRole } from "../types/team.type";

export interface TeamPermissions {
  canAccessTeam: boolean;
  canCreateTeam: boolean;
  canEditTeamDetails: boolean;
  canDeleteTeam: boolean;
  canViewDeleteTeam: boolean;
  canTransferOwnership: boolean;
  canChangeRole: boolean;
  canAddMember: boolean;
  canRemoveMember: boolean;
  canCreateProject: boolean;
  canCreateTask: boolean;
}

interface Params {
  globalRole?: UserRole;
  teamRole?: NullableTeamRole;
  isReadOnly?: boolean;
}

export function getTeamPermissions({
  globalRole,
  teamRole,
  isReadOnly = false,
}: Params): TeamPermissions {
  const { isSuperAdmin, isGlobalAdmin, isOwner, isAdmin } = resolveRoles(
    globalRole,
    teamRole,
  );

  const isSystemAdmin = isSuperAdmin || isGlobalAdmin;
  const canManage = isOwner || isAdmin;
  const canWrite = !isReadOnly;

  return {
    canAccessTeam: isSystemAdmin || canManage,

    canCreateTeam: isSystemAdmin,

    canEditTeamDetails: canWrite && isOwner,

    canDeleteTeam: canWrite && isOwner,

    canViewDeleteTeam: isSystemAdmin || canManage,

    canTransferOwnership: canWrite && (isOwner || isSuperAdmin),

    canChangeRole: canWrite && (isOwner || isSuperAdmin),

    canAddMember: canWrite && canManage,

    canRemoveMember: canWrite && canManage,

    canCreateProject: canWrite && canManage,

    canCreateTask: canWrite && canManage,
  };
}
