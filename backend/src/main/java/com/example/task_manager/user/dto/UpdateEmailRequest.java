package com.example.task_manager.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/*
 * Request payload for changing the current user's login email.
 */
public record UpdateEmailRequest(
    @NotBlank String currentPassword, @NotBlank @Email @Size(max = 150) String newEmail) {}
