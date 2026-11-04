import type { UserRole } from "../../users/types/userRole";
import type { ActivityRecord } from "../../../common/types/activity.types";

export interface Team {
  key: string;
  name: string;
  description?: string;
  owner?: User;
  createdBy?: User | null;
  deletedBy?: User | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  ownerChangedAt?: string | null;
  membershipChangedAt?: string | null;
  deletedAt?: string | null;
  isDeleted?: boolean;
}

export interface FailedMember {
  userId: string;
  reason: string;
  code: string;
}

export interface MemberBatchResult<T> {
  success: T[];
  failed: FailedMember[];
}

export type AddMembersResult = MemberBatchResult<TeamMember>;
export type RemoveMembersResult = MemberBatchResult<string>;

export interface AddMembersInput {
  members: { userId: string; role: "ADMIN" | "MEMBER" }[];
}

export interface RemoveMembersInput {
  userIds: string[];
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teamRole: NullableTeamRole;
  globalRole?: UserRole;
  joinedAt: string;
}

type User = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type TeamActivity = ActivityRecord;

export interface TeamMe {
  userId: string;
  role: NullableTeamRole;
}

export type NullableTeamRole = "OWNER" | "ADMIN" | "MEMBER" | null;

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";
