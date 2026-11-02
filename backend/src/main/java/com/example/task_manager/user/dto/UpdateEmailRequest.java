package com.example.task_manager.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/*
 * Request payload for changing the current user's login email.
 */
public record UpdateEmailRequest(
    @NotBlank String currentPassword, @NotBlank @Email String newEmail) {}
