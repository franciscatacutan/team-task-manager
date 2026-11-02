package com.example.task_manager.task.dto;

import java.time.Instant;
import java.util.UUID;

/** DTO for task update response. */
public record TaskActivityResponse(
    UUID id,
    String message,
    String type,
    ActivityDetails details,
    User user,
    Task task,
    Instant createdAt) {

  public record ActivityDetails(
      java.util.List<String> fields,
      String from,
      String to,
      String target,
      java.util.List<ActivityChange> changes,
      ActivityReference team,
      ActivityReference project,
      ActivityReference task,
      ActivityReference subjectUser) {}

  public record ActivityChange(String field, String label, String from, String to) {}

  public record ActivityReference(UUID id, String label) {}

  public record User(UUID id, String firstName, String lastName, String email) {}

  public record Task(UUID id, String name) {}
}
