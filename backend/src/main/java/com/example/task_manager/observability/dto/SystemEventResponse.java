package com.example.task_manager.observability.dto;

import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.observability.entity.SystemEventSeverity;
import java.time.Instant;
import java.util.UUID;

public record SystemEventResponse(
    UUID id,
    SystemEventSeverity severity,
    String category,
    String eventName,
    String source,
    UUID teamId,
    UUID projectId,
    UUID taskId,
    String message,
    User actor,
    ActivityEventDetails context,
    Instant occurredAt) {

  public record User(UUID id, String firstName, String lastName, String email) {}
}
