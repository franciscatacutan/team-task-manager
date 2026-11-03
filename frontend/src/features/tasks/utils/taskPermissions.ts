import { resolveRoles } from "../../../common/utils/roleHelpers";
import type { NullableTeamRole } from "../../teams/types/team.type";
import type { UserRole } from "../../users/types/userRole";

export interface TaskPermissions {
  canEditTaskDetails: boolean;
  canDeleteTask: boolean;
  canViewDeleteTask: boolean;
  canChangeStatus: boolean;
  canChangePriority: boolean;
  canAssign: boolean;
  canChangeSchedule: boolean;
  canComment: boolean;
}

interface Params {
  globalRole?: UserRole;
  teamRole?: NullableTeamRole;
  userId?: string;
  assigneeId?: string;
  supportId?: string;
  isReadOnly?: boolean;
}

export function getTaskPermissions({
  globalRole,
  teamRole,
  userId,
  assigneeId,
  supportId,
  isReadOnly = false,
}: Params): TaskPermissions {
  const { isSuperAdmin, isGlobalAdmin, isOwner, isAdmin, isMember } =
    resolveRoles(globalRole, teamRole);

  const hasMembership = isOwner || isAdmin || isMember;
  const isAssignee = Boolean(userId && assigneeId && userId === assigneeId);
  const isSupport = Boolean(userId && supportId && userId === supportId);

  const isSystemAdmin = isSuperAdmin || isGlobalAdmin;

  const canManage = isOwner || isAdmin;
  const canWrite = !isReadOnly;

  return {
    canEditTaskDetails: canWrite && canManage,

    canDeleteTask: canWrite && canManage,

    canViewDeleteTask: isSystemAdmin || canManage,

    canChangeStatus:
      canWrite && hasMembership && (canManage || isAssignee || isSupport),

    canChangePriority: canWrite && canManage,

    canAssign: canWrite && canManage,

    canChangeSchedule: canWrite && canManage,

    canComment:
      canWrite && hasMembership && (canManage || isAssignee || isSupport),
  };
}
