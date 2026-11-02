package com.example.task_manager.notification.dto;

import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.notification.entity.NotificationType;
import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
    UUID id,
    NotificationType type,
    ActivityEventType eventType,
    String title,
    String body,
    String targetPath,
    UUID teamId,
    UUID projectId,
    UUID taskId,
    User actor,
    boolean read,
    Instant readAt,
    Instant createdAt) {

  public record User(UUID id, String firstName, String lastName, String email) {}
}
