package com.example.task_manager.activity;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventDetails.ActivityChange;
import com.example.task_manager.activity.dto.ActivityEventDetails.ActivityReference;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.notification.NotificationService;
import com.example.task_manager.observability.ObservabilityService;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.dto.ProjectActivityResponse;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.dto.TaskActivityResponse;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.dto.TeamActivityResponse;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.user.entity.UserEntity;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Records and maps unified activity events. */
@Service
@RequiredArgsConstructor
public class ActivityEventService {

  private final ActivityEventRepository activityEventRepository;
  private final ActivityEventMessageBuilder messageBuilder;
  private final TeamRepository teamRepository;
  private final ProjectRepository projectRepository;
  private final TaskRepository taskRepository;
  private final ObservabilityService observabilityService;
  private final NotificationService notificationService;

  public ActivityEventEntity recordTeamEvent(
      TeamEntity team,
      UserEntity actor,
      ActivityEventType eventType,
      ActivityEventDetails details,
      String message) {

    ActivityEventDetails enrichedDetails =
        withContext(details, reference(team.getId(), team.getName()), null, null);

    ActivityEventEntity event =
        saveEvent(
            team.getId(),
            null,
            null,
            ActivityEntityType.TEAM,
            team.getId(),
            null,
            null,
            actor,
            eventType,
            enrichedDetails,
            message);

    teamRepository.updateLastActivity(team.getId(), event.getCreatedAt());

    return event;
  }

  public ActivityEventEntity recordProjectEvent(
      ProjectEntity project,
      UserEntity actor,
      ActivityEventType eventType,
      ActivityEventDetails details,
      String message) {

    ActivityEventDetails enrichedDetails =
        withContext(
            details,
            reference(project.getTeam().getId(), project.getTeam().getName()),
            reference(project.getId(), project.getName()),
            null);

    ActivityEventEntity event =
        saveEvent(
            project.getTeam().getId(),
            project.getId(),
            null,
            ActivityEntityType.PROJECT,
            project.getId(),
            ActivityEntityType.TEAM,
            project.getTeam().getId(),
            actor,
            eventType,
            enrichedDetails,
            message);

    projectRepository.updateLastActivity(project.getId(), event.getCreatedAt());

    return event;
  }

  public ActivityEventEntity recordTaskEvent(
      TaskEntity task,
      UserEntity actor,
      ActivityEventType eventType,
      ActivityEventDetails details,
      String message) {

    ActivityEventDetails enrichedDetails =
        withContext(
            details,
            reference(task.getProject().getTeam().getId(), task.getProject().getTeam().getName()),
            reference(task.getProject().getId(), task.getProject().getName()),
            reference(task.getId(), task.getName()));

    ActivityEventEntity event =
        saveEvent(
            task.getProject().getTeam().getId(),
            task.getProject().getId(),
            task.getId(),
            ActivityEntityType.TASK,
            task.getId(),
            ActivityEntityType.PROJECT,
            task.getProject().getId(),
            actor,
            eventType,
            enrichedDetails,
            message);

    taskRepository.updateLastActivity(task.getId(), event.getCreatedAt());

    return event;
  }

  private ActivityEventEntity saveEvent(
      java.util.UUID teamId,
      java.util.UUID projectId,
      java.util.UUID taskId,
      ActivityEntityType entityType,
      java.util.UUID entityId,
      ActivityEntityType parentEntityType,
      java.util.UUID parentEntityId,
      UserEntity actor,
      ActivityEventType eventType,
      ActivityEventDetails details,
      String message) {

    ActivityEventEntity event = new ActivityEventEntity();
    event.setTeamId(teamId);
    event.setProjectId(projectId);
    event.setTaskId(taskId);
    event.setEntityType(entityType);
    event.setEntityId(entityId);
    event.setParentEntityType(parentEntityType);
    event.setParentEntityId(parentEntityId);
    event.setEventType(eventType);
    event.setDetails(details == null ? emptyDetails() : details);
    event.setMessage(resolveMessage(eventType, details, message));
    event.setUser(actor);

    ActivityEventEntity savedEvent = activityEventRepository.save(event);
    observabilityService.recordFromActivity(savedEvent);
    notificationService.createFromActivity(savedEvent);

    return savedEvent;
  }

  public ActivityEventEntity recordTaskComment(TaskEntity task, UserEntity actor, String message) {
    return recordTaskEvent(task, actor, ActivityEventType.TASK_COMMENTED, emptyDetails(), message);
  }

  public TaskActivityResponse toTaskActivitiesResponse(ActivityEventEntity entity) {
    ActivityEventDetails details = readDetails(entity);

    TaskActivityResponse.User user =
        new TaskActivityResponse.User(
            entity.getUser().getId(),
            entity.getUser().getFirstName(),
            entity.getUser().getLastName(),
            entity.getUser().getEmail());

    TaskActivityResponse.Task task =
        entity.getTaskId() == null
            ? null
            : new TaskActivityResponse.Task(
                entity.getTaskId(), entity.getTask() != null ? entity.getTask().getName() : null);

    return new TaskActivityResponse(
        entity.getId(),
        entity.getMessage(),
        entity.getEventType().name(),
        toFrontendDetails(details),
        user,
        task,
        entity.getCreatedAt());
  }

  public ProjectActivityResponse toProjectActivitiesResponse(ActivityEventEntity entity) {
    ActivityEventDetails details = readDetails(entity);

    ProjectActivityResponse.User user =
        new ProjectActivityResponse.User(
            entity.getUser().getId(),
            entity.getUser().getFirstName(),
            entity.getUser().getLastName(),
            entity.getUser().getEmail());

    ProjectActivityResponse.Task task =
        entity.getTaskId() == null
            ? null
            : new ProjectActivityResponse.Task(
                entity.getTaskId(), resolveTaskLabel(entity, details));

    return new ProjectActivityResponse(
        entity.getId(),
        entity.getMessage(),
        entity.getEventType().name(),
        toFrontendDetails(details),
        user,
        task,
        entity.getCreatedAt());
  }

  public TeamActivityResponse toTeamActivitiesResponse(ActivityEventEntity entity) {
    ActivityEventDetails details = readDetails(entity);

    TeamActivityResponse.User user =
        new TeamActivityResponse.User(
            entity.getUser().getId(),
            entity.getUser().getFirstName(),
            entity.getUser().getLastName(),
            entity.getUser().getEmail());

    TeamActivityResponse.Project project =
        entity.getProjectId() == null
            ? null
            : new TeamActivityResponse.Project(
                entity.getProjectId(), resolveProjectLabel(entity, details));

    TeamActivityResponse.Task task =
        entity.getTaskId() == null
            ? null
            : new TeamActivityResponse.Task(entity.getTaskId(), resolveTaskLabel(entity, details));

    return new TeamActivityResponse(
        entity.getId(),
        entity.getMessage(),
        entity.getEventType().name(),
        toFrontendDetails(details),
        user,
        project,
        task,
        entity.getCreatedAt());
  }

  private TaskActivityResponse.ActivityDetails toFrontendDetails(ActivityEventDetails details) {
    return new TaskActivityResponse.ActivityDetails(
        details.fields() == null ? List.of() : details.fields(),
        details.from(),
        details.to(),
        details.target(),
        details.changes() == null
            ? List.of()
            : details.changes().stream()
                .map(
                    change ->
                        new TaskActivityResponse.ActivityChange(
                            change.field(), change.label(), change.from(), change.to()))
                .toList(),
        toFrontendReference(details.team()),
        toFrontendReference(details.project()),
        toFrontendReference(details.task()),
        toFrontendReference(details.subjectUser()));
  }

  public ActivityEventDetails emptyDetails() {
    return new ActivityEventDetails(List.of(), null, null, null, List.of(), null, null, null, null);
  }

  public ActivityReference reference(java.util.UUID id, String label) {
    if (id == null || label == null || label.isBlank()) {
      return null;
    }

    return new ActivityReference(id, label);
  }

  public ActivityReference reference(UserEntity user) {
    if (user == null) {
      return null;
    }

    return reference(user.getId(), user.getFullName());
  }

  public ActivityChange change(String field, String label, Object from, Object to) {
    return new ActivityChange(field, label, stringify(from), stringify(to));
  }

  private ActivityEventDetails readDetails(ActivityEventEntity entity) {
    return entity.getDetails() == null ? emptyDetails() : entity.getDetails();
  }

  private ActivityEventDetails withContext(
      ActivityEventDetails details,
      ActivityReference team,
      ActivityReference project,
      ActivityReference task) {

    ActivityEventDetails base = details == null ? emptyDetails() : details;

    return new ActivityEventDetails(
        base.fields(),
        base.from(),
        base.to(),
        base.target(),
        base.changes(),
        base.team() != null ? base.team() : team,
        base.project() != null ? base.project() : project,
        base.task() != null ? base.task() : task,
        base.subjectUser());
  }

  private String resolveMessage(
      ActivityEventType eventType, ActivityEventDetails details, String message) {

    if (message != null && !message.isBlank()) {
      return message;
    }

    return messageBuilder.build(eventType, details);
  }

  private String resolveProjectLabel(ActivityEventEntity entity, ActivityEventDetails details) {
    if (details.project() != null && details.project().label() != null) {
      return details.project().label();
    }

    if (entity.getTask() != null && entity.getTask().getProject() != null) {
      return entity.getTask().getProject().getName();
    }

    return null;
  }

  private String resolveTaskLabel(ActivityEventEntity entity, ActivityEventDetails details) {
    if (details.task() != null && details.task().label() != null) {
      return details.task().label();
    }

    if (entity.getTask() != null) {
      return entity.getTask().getName();
    }

    return null;
  }

  private TaskActivityResponse.ActivityReference toFrontendReference(ActivityReference reference) {
    if (reference == null) {
      return null;
    }

    return new TaskActivityResponse.ActivityReference(reference.id(), reference.label());
  }

  private String stringify(Object value) {
    return value == null ? null : value.toString();
  }
}
