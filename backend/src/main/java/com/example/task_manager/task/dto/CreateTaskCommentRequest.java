package com.example.task_manager.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** DTO for creating a task update. */
public record CreateTaskCommentRequest(@NotBlank @Size(max = 2000) String message) {}
