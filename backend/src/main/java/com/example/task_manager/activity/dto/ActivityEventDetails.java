package com.example.task_manager.activity.dto;

import java.util.List;
import java.util.UUID;

/** Structured metadata for activity events. */
public record ActivityEventDetails(
    List<String> fields,
    String from,
    String to,
    String target,
    List<ActivityChange> changes,
    ActivityReference team,
    ActivityReference project,
    ActivityReference task,
    ActivityReference subjectUser) {

  public ActivityEventDetails {
    fields = fields == null ? List.of() : List.copyOf(fields);
    changes = changes == null ? List.of() : List.copyOf(changes);
  }

  public record ActivityChange(String field, String label, String from, String to) {}

  public record ActivityReference(UUID id, String label) {}
}
