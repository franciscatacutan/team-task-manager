package com.example.task_manager.team.dto;

import jakarta.validation.constraints.Size;

/** DTO for updating a team. */
public record UpdateTeamRequest(
    @Size(max = 100) String name, @Size(max = 2000) String description) {}
