import type { TaskPriority } from "../utils/taskPriority";
import type { TaskStatus } from "../utils/task.constants";

export type Task = {
  taskNumber: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedUser?: TaskUser;
  supportUser?: TaskUser;
  plannedStartDate?: string;
  plannedDueDate?: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: string;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
}

import type {
  ActivityDetails,
  ActivityType,
} from "../../../common/types/activity.types";

export interface TaskActivity {
  id: string;
  message: string;
  type: ActivityType;
  details: ActivityDetails;
  user: User;
  task?: Task;
  createdAt: string;
}

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
};
