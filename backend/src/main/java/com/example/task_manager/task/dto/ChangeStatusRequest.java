package com.example.task_manager.task.dto;

import com.example.task_manager.task.entity.TaskStatus;
import jakarta.validation.constraints.NotNull;

/** DTO for changing status of a task. */
public record ChangeStatusRequest(@NotNull TaskStatus status) {}
