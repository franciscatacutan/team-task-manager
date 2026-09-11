package com.example.task_manager.project.dto;

import java.time.Instant;
import java.util.UUID;

import com.example.task_manager.project.entity.ProjectStatus;

/**
 * DTO for returning project information.
 */
public record ProjectResponse(
    String key,
    String name,
    String description,
    ProjectStatus status,
    UUID teamId,
    ProjectUserSummary owner,
    ProjectUserSummary createdBy,
    ProjectUserSummary completedBy,
    ProjectUserSummary deletedBy,
    Instant plannedStartDate,
    Instant plannedDueDate,
    Instant actualStartDate,
    Instant actualCompletionDate,
    Instant createdAt,
    Instant updatedAt,
    Instant lastActivityAt,
    Instant statusChangedAt,
    Instant deletedAt,
    boolean deleted) {

  /**
   * DTO for project owner information.
   */
  public record ProjectUserSummary(
      UUID id,
      String firstName,
      String lastName,
      String email) {
  }
}
