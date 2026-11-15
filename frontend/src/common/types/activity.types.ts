export type ActivityType =
  | "TEAM_CREATED"
  | "TASK_CREATED"
  | "PROJECT_CREATED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "TEAM_MEMBER_ROLE_CHANGED"
  | "TEAM_OWNERSHIP_TRANSFERRED"
  | "PROJECT_STATUS_CHANGED"
  | "TASK_UPDATED"
  | "TASK_DELETED"
  | "TASK_STATUS_CHANGED"
  | "TASK_ASSIGNEE_CHANGED"
  | "TASK_SUPPORT_ASSIGNED"
  | "TASK_SUPPORT_CHANGED"
  | "TASK_SUPPORT_REMOVED"
  | "TASK_COMMENTED"
  | "PROJECT_DELETED"
  | "TEAM_DELETED"
  | "PROJECT_UPDATED"
  | "TEAM_UPDATED";

export interface ActivityChange {
  field: string;
  label: string | null;
  from: string | null;
  to: string | null;
}

export interface ActivityReference {
  id: string;
  label: string;
}

export interface ActivityDetails {
  fields: string[];
  from: string | null;
  to: string | null;
  target: string | null;
  changes?: ActivityChange[];
  team?: ActivityReference | null;
  project?: ActivityReference | null;
  task?: ActivityReference | null;
  subjectUser?: ActivityReference | null;
}

/** Identity, display data, and authorized navigation are separate fields. */
export interface ActivityRecord {
  id: string;
  message: string;
  type: ActivityType;
  details: ActivityDetails;
  user: { id?: string; firstName: string; lastName: string; email: string };
  project?: { id?: string; key?: string | null; name: string | null } | null;
  task?: {
    id?: string;
    taskNumber?: number | null;
    name: string | null;
  } | null;
  createdAt: string;
  targetPath?: string | null;
}
export interface ActivityQueryParams {
  page?: number;
  size?: number;
  search?: string;
  sort?: string;
}
