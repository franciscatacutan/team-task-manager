package com.example.task_manager.notification;

import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.common.WorkspacePaths;
import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.config.security.Authorization.WorkspaceReadPolicy;
import com.example.task_manager.notification.dto.NotificationDestinationResponse;
import com.example.task_manager.notification.entity.NotificationEntity;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationDestinationResolver {
  private final TeamRepository teams;
  private final ProjectRepository projects;
  private final TaskRepository tasks;
  private final WorkspaceReadPolicy reads;
  private final GlobalAuthorizationService globals;

  public NotificationDestinationResponse resolve(NotificationEntity item, UserEntity viewer) {
    var event = item.getActivityEvent();
    UUID taskId =
        item.getTaskId() != null ? item.getTaskId() : event == null ? null : event.getTaskId();
    UUID projectId =
        item.getProjectId() != null
            ? item.getProjectId()
            : event == null ? null : event.getProjectId();
    UUID teamId =
        item.getTeamId() != null ? item.getTeamId() : event == null ? null : event.getTeamId();
    boolean global = globals.isGlobalAdmin(viewer);
    if (taskId != null) {
      return tasks
          .findById(taskId)
          .filter(
              task ->
                  (teamId == null || teamId.equals(task.getProject().getTeam().getId()))
                      && (projectId == null || projectId.equals(task.getProject().getId()))
                      && reads
                          .forTeam(task.getProject().getTeam().getId(), viewer.getId(), global)
                          .task(task))
          .map(task -> NotificationDestinationResponse.available(WorkspacePaths.task(task)))
          .orElseGet(NotificationDestinationResponse::unavailable);
    }
    if (projectId != null) {
      return projects
          .findById(projectId)
          .filter(
              project ->
                  (teamId == null || teamId.equals(project.getTeam().getId()))
                      && reads
                          .forTeam(project.getTeam().getId(), viewer.getId(), global)
                          .project(project))
          .map(
              project -> NotificationDestinationResponse.available(WorkspacePaths.project(project)))
          .orElseGet(NotificationDestinationResponse::unavailable);
    }
    if (teamId != null) {
      return teams
          .findById(teamId)
          .filter(team -> reads.forTeam(team.getId(), viewer.getId(), global).team(team))
          .map(
              team ->
                  NotificationDestinationResponse.available(
                      WorkspacePaths.team(team)
                          + (event != null && isMembership(event.getEventType())
                              ? "/members"
                              : "")))
          .orElseGet(NotificationDestinationResponse::unavailable);
    }
    return NotificationDestinationResponse.unavailable();
  }

  private boolean isMembership(ActivityEventType type) {
    return Set.of(
            ActivityEventType.TEAM_MEMBER_ADDED,
            ActivityEventType.TEAM_MEMBER_REMOVED,
            ActivityEventType.TEAM_MEMBER_ROLE_CHANGED,
            ActivityEventType.TEAM_OWNERSHIP_TRANSFERRED)
        .contains(type);
  }
}
