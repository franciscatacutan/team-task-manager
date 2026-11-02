package com.example.task_manager.user.dto;

import com.example.task_manager.user.entity.UserRole;
import java.util.UUID;

/*
 * Data Transfer Object for user responses.
 */
public record UserResponse(
    UUID id, String firstName, String lastName, String email, UserRole role) {}
