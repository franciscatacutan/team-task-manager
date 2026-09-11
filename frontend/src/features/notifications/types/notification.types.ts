export type NotificationType = "TEAM" | "PROJECT" | "TASK";

export type NotificationEventType =
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

export type NotificationActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
} | null;

export type AppNotification = {
  id: string;
  type: NotificationType;
  eventType?: NotificationEventType | null;
  title: string;
  body: string;
  targetPath: string;
  teamKey?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  actor: NotificationActor;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type UnreadNotificationCount = {
  unreadCount: number;
};
