export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "DELETED";

export type Project = {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  teamKey: string;
  owner?: User;
  createdBy: User;
  completedBy?: User | null;
  deletedBy?: User | null;
  lastActivityAt: string;
  plannedStartDate?: string;
  plannedDueDate?: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  createdAt: string;
  updatedAt: string;
  statusChangedAt?: string;
  deletedAt?: string | null;
  deleted?: boolean;
};

type User = {
  id?: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Task = {
  id: string;
  title: string;
};

export type ProjectActivity = {
  id: string;
  message: string;
  user: User;
  task: Task;
  createdAt: string;
};

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  plannedStartDate?: string;
  plannedDueDate?: string;
}
