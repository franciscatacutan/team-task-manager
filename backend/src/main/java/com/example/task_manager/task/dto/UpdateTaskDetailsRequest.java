package com.example.task_manager.task.dto;

import com.example.task_manager.task.entity.TaskPriority;
import jakarta.validation.constraints.Size;

/** DTO for updating an existing task. */
public record UpdateTaskDetailsRequest(
    @Size(max = 100) String name,
    @Size(max = 2000) String description,
    TaskPriority priority,
    String plannedStartDate,
    String plannedDueDate) {
  public UpdateTaskDetailsRequest {
    name = name == null ? null : name.trim();
  }
}
