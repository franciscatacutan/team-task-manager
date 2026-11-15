package com.example.task_manager.observability.dto;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.observability.entity.AuditAction;
import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
    UUID id,
    UUID teamId,
    UUID projectId,
    UUID taskId,
    ActivityEntityType entityType,
    UUID entityId,
    AuditAction action,
    ActivityEventType eventType,
    User actor,
    String summary,
    ActivityEventDetails metadata,
    Instant occurredAt) {

  public record User(UUID id, String firstName, String lastName, String email) {}
}
