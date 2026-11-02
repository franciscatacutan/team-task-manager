package com.example.task_manager.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** DTO for creating a new project. */
public record CreateProjectRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 2000) String description,
    Instant plannedStartDate,
    Instant plannedDueDate) {}
