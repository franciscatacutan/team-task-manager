import type { ProjectStatus } from "./project.types";

export interface ProjectInsights {
  teamId: string;
  projectId: string;
  status: ProjectStatus;
  plannedStartDate?: string | null;
  plannedDueDate?: string | null;
  actualStartDate?: string | null;
  actualCompletionDate?: string | null;
  generatedAt: string;
  tasks: ProjectTaskMetrics;
  flow: ProjectFlowMetrics;
  activity: ProjectActivityMetrics;
  health: ProjectHealthMetrics;
}

export interface ProjectTaskMetrics {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  onHold: number;
  done: number;
  cancelled: number;
  overdue: number;
  highPriority: number;
  criticalPriority: number;
}

export interface ProjectFlowMetrics {
  completedLast7Days: number;
  completionRatePercent: number;
  averageCycleTimeHours: number;
}

export interface ProjectActivityMetrics {
  activityEventsLast7Days: number;
  auditEventsLast7Days: number;
  systemEventsLast7Days: number;
}

export interface ProjectHealthMetrics {
  overdue: boolean;
  daysUntilDue: number;
  completedOnTime: boolean;
}
