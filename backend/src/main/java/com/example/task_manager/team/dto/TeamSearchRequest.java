package com.example.task_manager.team.dto;

import com.example.task_manager.common.DeletedFilter;
import java.util.UUID;

/*
 * DTO for fetching teams with search, filtering and sort
 */
public record TeamSearchRequest(
    String search, UUID ownerId, UUID memberId, DeletedFilter deletedFilter) {

  public DeletedFilter deletedFilter() {
    return deletedFilter == null ? DeletedFilter.ACTIVE : deletedFilter;
  }
}
