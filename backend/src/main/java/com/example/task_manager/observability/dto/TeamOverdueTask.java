package com.example.task_manager.observability.dto;

import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import java.time.LocalDate;

public record TeamOverdueTask(
    long taskNumber,
    String name,
    TaskStatus status,
    TaskPriority priority,
    LocalDate plannedDueDay,
    String projectKey,
    String projectName) {}
