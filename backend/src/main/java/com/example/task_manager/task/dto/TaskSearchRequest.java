package com.example.task_manager.task.dto;

import com.example.task_manager.common.DeletedFilter;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import java.util.List;
import java.util.UUID;

/*
 * DTO for fetching task with search, filtering and sort
 */
public record TaskSearchRequest(
    String search,
    List<TaskStatus> status,
    List<TaskPriority> priority,
    UUID assigneeId,
    UUID supportId,
    Boolean overdue,
    DeletedFilter deletedFilter,
    Boolean all) {

  public Boolean all() {
    return Boolean.TRUE.equals(all);
  }

  public DeletedFilter deletedFilter() {
    return deletedFilter == null ? DeletedFilter.ACTIVE : deletedFilter;
  }
}
