package com.example.task_manager.project.dto;

import jakarta.validation.constraints.Size;
import java.time.Instant;

/** DTO for updating an existing project. */
public record UpdateProjectDetailsRequest(
    @Size(max = 100) String name,
    @Size(max = 2000) String description,
    Instant plannedStartDate,
    Instant plannedDueDate) {}
