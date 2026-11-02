package com.example.task_manager.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request payload for admin-initiated password resets. */
public record AdminResetPasswordRequest(
    @NotBlank
        @Size(min = 8, message = "Password should be at least 8 characters")
        @Pattern(
            regexp =
                "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-\\[\\]{};':\"\\\\|,.<>/?]).{8,}$",
            message = "Password must contain upper, lower, digit, and special character")
        String newPassword) {}
