package com.example.task_manager.user.dto;

import jakarta.validation.constraints.Size;

/*
 * DTO for updating user profile information.
 */
public record UpdateUserProfileRequest(
    @Size(max = 100) String firstName, @Size(max = 100) String lastName) {}
