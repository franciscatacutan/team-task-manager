package com.example.task_manager.team.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateTeamInvitationRequest(
    @NotBlank
        @Email
        @Size(max = 150)
        @Pattern(regexp = "^[^@]+@[^@]+\\.[^@]+$", message = "Please enter a valid email address")
        String email) {}
