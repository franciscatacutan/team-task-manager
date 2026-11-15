package com.example.task_manager.project.dto;

import com.example.task_manager.project.entity.ProjectStatus;
import jakarta.validation.constraints.Positive;

/** DTO for changing status of a project. */
public record ChangeProjectStatusRequest(
    ProjectStatus status, @Positive Long confirmedOpenTaskCount) {}
