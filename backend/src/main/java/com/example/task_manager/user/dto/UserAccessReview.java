package com.example.task_manager.user.dto;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

public record UserAccessReview(
    Instant archivedAt, UserRole role, List<TeamAccess> teams, PageResponse<OpenTask> openTasks) {

  public record TeamAccess(
      @NotBlank String key, @NotBlank String name, @NotNull TeamRole role, boolean archived) {}

  public record OpenTask(
      String teamKey, String projectKey, Long number, String name, boolean assignee) {}

  public record RestoreRequest(
      @NotNull Instant archivedAt,
      @NotNull UserRole role,
      @NotNull List<@NotNull @Valid TeamAccess> teams) {}
}
