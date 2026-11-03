package com.example.task_manager.task.dto;

import com.example.task_manager.task.entity.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** DTO for creating a new task. */
public record CreateTaskRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 2000) String description,
    @NotNull TaskPriority priority,
    @NotNull Instant plannedStartDate,
    @NotNull Instant plannedDueDate,
    @NotNull UUID assigneeId,
    UUID supportId) {
  public CreateTaskRequest {
    name = name == null ? null : name.trim();
  }
}
