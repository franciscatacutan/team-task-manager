package com.example.task_manager.auth.dto;

import com.example.task_manager.user.entity.UserRole;
import java.util.UUID;

/** DTO for returning JWT token. */
public record AuthResponse(String token, long expiresInSeconds, User user) {
  public record User(UUID userId, String firstName, String lastName, String email, UserRole role) {}
}
