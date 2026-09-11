import type { UserRole } from "../../users/types/userRole";
import type {
  ActivityDetails,
  ActivityType,
} from "../../../common/types/activity.types";

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
  globalRole: UserRole;
  joinedAt: string;
}

type User = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Project = {
  id: string;
  title: string;
};

type Task = {
  taskNumber: number;
  title: string;
};

export type TeamActivity = {
  id: string;
  message: string;
  type: ActivityType;
  details: ActivityDetails;
  user: User;
  project?: Project | null;
  task?: Task | null;
  createdAt: string;
};

export interface TeamMe {
  userId: string;
  role: NullableTeamRole;
}

export type NullableTeamRole = "OWNER" | "ADMIN" | "MEMBER" | null;

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";
