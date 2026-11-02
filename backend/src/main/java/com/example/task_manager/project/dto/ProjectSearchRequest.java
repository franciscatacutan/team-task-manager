package com.example.task_manager.project.dto;

import com.example.task_manager.common.DeletedFilter;
import com.example.task_manager.project.entity.ProjectStatus;
import java.util.List;
import java.util.UUID;

/*
 * DTO for fetching projects with search, filtering and sort
 */
public record ProjectSearchRequest(
    String search,
    List<ProjectStatus> status,
    UUID createdBy,
    DeletedFilter deletedFilter,
    Boolean all) {

  public Boolean all() {
    return Boolean.TRUE.equals(all);
  }

  public DeletedFilter deletedFilter() {
    return deletedFilter == null ? DeletedFilter.ACTIVE : deletedFilter;
  }
}
