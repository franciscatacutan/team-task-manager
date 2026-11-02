package com.example.task_manager.observability.dto;

import com.example.task_manager.project.entity.ProjectStatus;
import java.time.Instant;
import java.util.UUID;

public record ProjectInsightsResponse(
    UUID teamId,
    UUID projectId,
    ProjectStatus status,
    Instant plannedStartDate,
    Instant plannedDueDate,
    Instant actualStartDate,
    Instant actualCompletionDate,
    Instant generatedAt,
    TaskMetrics tasks,
    FlowMetrics flow,
    ActivityMetrics activity,
    HealthMetrics health) {

  public record TaskMetrics(
      long total,
      long todo,
      long inProgress,
      long inReview,
      long onHold,
      long done,
      long cancelled,
      long overdue,
      long highPriority,
      long criticalPriority) {}

  public record FlowMetrics(
      long completedLast7Days, double completionRatePercent, double averageCycleTimeHours) {}

  public record ActivityMetrics(
      long activityEventsLast7Days, long auditEventsLast7Days, long systemEventsLast7Days) {}

  public record HealthMetrics(boolean overdue, long daysUntilDue, boolean completedOnTime) {}
}
