package com.example.task_manager.task.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** DTO for changing user assignment of a task. */
public record ChangeAssignmentRequest(@NotNull UUID assigneeId, UUID supportId) {}
