export interface TeamInsights {
  teamId: string;
  generatedAt: string;
  membership: MembershipMetrics;
  tasks: TaskMetrics;
  projects: ProjectMetrics;
  flow: FlowMetrics;
  activity: ActivityMetrics;
  health: HealthMetrics;
}

export interface MembershipMetrics {
  total: number;
  owners: number;
  admins: number;
  members: number;
}

export interface TaskMetrics {
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

export interface ProjectMetrics {
  total: number;
  active: number;
  onHold: number;
  completed: number;
  completedLast7Days: number;
  completionRatePercent: number;
}

export interface FlowMetrics {
  completedLast7Days: number;
  completionRatePercent: number;
  averageCycleTimeHours: number;
}

export interface ActivityMetrics {
  activityEventsLast7Days: number;
  auditEventsLast7Days: number;
  systemEventsLast7Days: number;
}

export interface HealthMetrics {
  openTasks: number;
  overdueTasks: number;
  openTasksPerMember: number;
  activeProjectsPerMember: number;
}
