package com.example.task_manager.task.dto;

import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import java.time.LocalDate;

public record MyWorkItem(
    long taskNumber,
    String name,
    TaskStatus status,
    TaskPriority priority,
    LocalDate plannedDueDay,
    String teamKey,
    String teamName,
    String projectKey,
    String projectName,
    boolean assigned) {}
