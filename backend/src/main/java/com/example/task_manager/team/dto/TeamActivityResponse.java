package com.example.task_manager.team.dto;

import com.example.task_manager.task.dto.TaskActivityResponse.ActivityDetails;
import java.time.Instant;
import java.util.UUID;

public record TeamActivityResponse(
    UUID id,
    String message,
    String type,
    ActivityDetails details,
    User user,
    Project project,
    Task task,
    Instant createdAt) {

  public record User(UUID id, String firstName, String lastName, String email) {}

  public record Project(UUID id, String name) {}

  public record Task(UUID id, String name) {}
}
