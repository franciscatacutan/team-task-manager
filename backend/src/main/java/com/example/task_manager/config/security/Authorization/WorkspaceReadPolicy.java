package com.example.task_manager.config.security.Authorization;

import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.entity.TeamEntity;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * One read policy shared by detail endpoints and navigation; current membership is never cached.
 */
@Component
@RequiredArgsConstructor
public class WorkspaceReadPolicy {
  private final TeamMemberRepository members;
  private final TeamAuthorizationService teams;

  public Access forTeam(UUID teamId, UUID userId, boolean globalAdmin) {
    if (globalAdmin) return new Access(teamId, true, true);
    return members
        .findByTeamIdAndUserId(teamId, userId)
        .map(member -> new Access(teamId, true, teams.canManageTeam(member)))
        .orElseGet(() -> new Access(teamId, false, false));
  }

  /** A request-scoped snapshot can be reused while mapping one authorized history page. */
  public record Access(UUID teamId, boolean canReadActive, boolean canReadArchived) {
    private boolean allows(TeamEntity team, boolean archived) {
      return teamId.equals(team.getId()) && canReadActive && (!archived || canReadArchived);
    }

    public boolean team(TeamEntity team) {
      return allows(team, team.getDeletedAt() != null);
    }

    public boolean project(ProjectEntity project) {
      return allows(
          project.getTeam(),
          project.getDeletedAt() != null || project.getTeam().getDeletedAt() != null);
    }

    public boolean task(TaskEntity task) {
      return allows(
          task.getProject().getTeam(),
          task.getDeletedAt() != null
              || task.getProject().getDeletedAt() != null
              || task.getProject().getTeam().getDeletedAt() != null);
    }
  }
}
