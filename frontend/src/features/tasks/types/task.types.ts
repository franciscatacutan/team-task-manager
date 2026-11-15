import type { ActivityRecord } from "@/common/types/activity.types";
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
  plannedStartDay?: string | null;
  plannedDueDay?: string | null;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  deletedAt?: string | null;
  deletedBy?: TaskUser | null;
  readOnly?: boolean;
};

export type MyWorkItem = Pick<
  Task,
  "taskNumber" | "name" | "status" | "priority" | "plannedDueDay"
> & {
  teamKey: string;
  teamName: string;
  projectKey: string;
  projectName: string;
  assigned: boolean;
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
  assigneeId?: string;
  overdue?: boolean;
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

export type TaskActivity = ActivityRecord;

/** Public workspace routing identity, distinct from persistence IDs. */
export interface TaskScope {
  teamKey: string;
  projectKey: string;
  taskNumber: number;
}
