package com.example.task_manager.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.notification.entity.NotificationEntity;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
  @Mock NotificationRepository notifications;
  @Mock UserRepository users;
  @Mock TeamMemberRepository members;
  @Mock TeamRepository teams;
  @Mock TaskRepository tasks;
  @Mock ProjectRepository projects;
  @InjectMocks NotificationService service;

  @Test
  void newTaskNotificationsUsePublicKeysAndTaskNumbers() {
    TeamEntity team = team();
    ProjectEntity project = project(team);
    UserEntity recipient = user();
    TaskEntity task = task(project);
    task.setAssignee(recipient);
    ActivityEventEntity event = event(ActivityEventType.TASK_COMMENTED, team, project, task);
    when(tasks.findById(task.getId())).thenReturn(Optional.of(task));
    service.createFromActivity(event);
    var saved = ArgumentCaptor.forClass(NotificationEntity.class);
    verify(notifications).save(saved.capture());
    assertThat(saved.getValue().getTargetPath()).isEqualTo("/teams/TEAM-A/projects/PROJ-A/tasks/42");
  }

  @ParameterizedTest
  @EnumSource(value = ActivityEventType.class, names = {
      "TASK_COMMENTED", "PROJECT_UPDATED", "TEAM_MEMBER_ADDED", "TEAM_DELETED"
  })
  void existingInboxItemsResolveCurrentRoutesInsteadOfStoredUuidPaths(ActivityEventType type) {
    TeamEntity team = team();
    ProjectEntity project = project(team);
    TaskEntity task = task(project);
    ActivityEventEntity event;
    String expected;
    if (type == ActivityEventType.TASK_COMMENTED) {
      event = event(type, team, project, task);
      when(tasks.findById(task.getId())).thenReturn(Optional.of(task));
      expected = "/teams/TEAM-A/projects/PROJ-A/tasks/42";
    } else if (type == ActivityEventType.PROJECT_UPDATED) {
      event = event(type, team, project, null);
      when(projects.findById(project.getId())).thenReturn(Optional.of(project));
      expected = "/teams/TEAM-A/projects/PROJ-A";
    } else {
      event = event(type, team, null, null);
      when(teams.findById(team.getId())).thenReturn(Optional.of(team));
      expected = "/teams/TEAM-A" + (type == ActivityEventType.TEAM_MEMBER_ADDED ? "/members" : "");
    }
    NotificationEntity item = new NotificationEntity();
    item.setActivityEvent(event);
    item.setTargetPath("/teams/" + team.getId());
    when(notifications.findInbox(any(), any())).thenReturn(new PageImpl<>(List.of(item)));
    assertThat(service.getInbox("test@example.test", Pageable.unpaged()).content().getFirst().targetPath())
        .isEqualTo(expected);
  }

  private TeamEntity team() {
    TeamEntity team = new TeamEntity();
    team.setId(UUID.randomUUID());
    team.setKey("TEAM-A");
    return team;
  }

  private ProjectEntity project(TeamEntity team) {
    ProjectEntity project = new ProjectEntity();
    project.setId(UUID.randomUUID());
    project.setKey("PROJ-A");
    project.setTeam(team);
    return project;
  }

  private TaskEntity task(ProjectEntity project) {
    TaskEntity task = new TaskEntity();
    task.setId(UUID.randomUUID());
    task.setProject(project);
    task.setTaskNumber(42L);
    return task;
  }

  private UserEntity user() {
    UserEntity user = new UserEntity();
    user.setId(UUID.randomUUID());
    user.setFirstName("Test");
    user.setLastName("User");
    return user;
  }

  private ActivityEventEntity event(ActivityEventType type, TeamEntity team, ProjectEntity project, TaskEntity task) {
    ActivityEventEntity event = new ActivityEventEntity();
    event.setUser(user());
    event.setEventType(type);
    event.setMessage("Test comment");
    event.setTeamId(team.getId());
    event.setProjectId(project == null ? null : project.getId());
    event.setTaskId(task == null ? null : task.getId());
    return event;
  }
}
