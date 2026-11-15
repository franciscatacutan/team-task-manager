package com.example.task_manager.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Sign-in verifies stored credentials; new-password policy belongs to creation/change requests. */
public record LoginRequest(
    @NotBlank @Size(max = 150) @Pattern(regexp = "^[^@]+@[^@]+\\.[^@]+$") @Email String email,
    @NotBlank String password) {}
