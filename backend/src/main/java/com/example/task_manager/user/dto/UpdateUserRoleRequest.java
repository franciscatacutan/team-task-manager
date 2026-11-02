package com.example.task_manager.user.dto;

import com.example.task_manager.user.entity.UserRole;
import jakarta.validation.constraints.NotNull;

/** Request payload for updating a user's role. */
public record UpdateUserRoleRequest(@NotNull UserRole role) {}
