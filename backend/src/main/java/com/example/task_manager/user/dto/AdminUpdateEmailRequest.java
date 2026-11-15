package com.example.task_manager.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request payload for admin-initiated login email updates. */
public record AdminUpdateEmailRequest(@NotBlank @Email @Size(max = 150) String email) {}
