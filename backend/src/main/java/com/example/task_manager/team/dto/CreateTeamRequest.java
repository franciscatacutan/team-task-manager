package com.example.task_manager.team.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DTO for creating a new team. */
public record CreateTeamRequest(
    @NotBlank @Size(max = 100) String name, @Size(max = 2000) String description) {}
