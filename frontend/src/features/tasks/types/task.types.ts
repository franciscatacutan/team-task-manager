import type { DeletedFilter } from "@/common/types/deletedFilter.types";
import type { TaskPriority } from "../constants/task.constants";
import type { TaskStatus } from "../utils/task.constants";

export type Task = {
  taskNumber: number;
  name: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignedUser?: TaskUser;
  supportUser?: TaskUser | null;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  deletedAt?: string | null;
  deletedBy?: TaskUser | null;
  readOnly?: boolean;
};

export interface TaskUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TaskQueryParams {
  page?: number;
  size?: number;
  search?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  sort?: string;
  deletedFilter: DeletedFilter;
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  priority?: TaskPriority;
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
  user: TaskUser;
  task?: { id: string; name: string | null; taskNumber?: number } | null;
  createdAt: string;
}
