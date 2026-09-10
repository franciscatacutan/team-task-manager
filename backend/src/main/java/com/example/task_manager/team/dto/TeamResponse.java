package com.example.task_manager.team.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO for returning team and owner information.
 */
public record TeamResponse(
    String key,
    String name,
    String description,
    User owner,
    User createdBy,
    User deletedBy,
    Instant createdAt,
    Instant updatedAt,
    Instant lastActivityAt,
    Instant ownerChangedAt,
    Instant membershipChangedAt,
    Instant deletedAt,
    Boolean isDeleted) {

  // Owner Info
  public record User(
      UUID userId,
      String firstName,
      String lastName,
      String email) {
  }
}
