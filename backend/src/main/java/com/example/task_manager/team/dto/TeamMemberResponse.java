package com.example.task_manager.team.dto;

import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserRole;
import java.time.Instant;
import java.util.UUID;

/** DTO for returning team member information. */
public record TeamMemberResponse(
    UUID id,
    String firstName,
    String lastName,
    String email,
    TeamRole teamRole,
    UserRole globalRole,
    Instant joinedAt,
    User addedBy) {
  public record User(UUID userId, String firstName, String lastName, String email) {}
}
