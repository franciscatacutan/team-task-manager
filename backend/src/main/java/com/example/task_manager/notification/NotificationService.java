package com.example.task_manager.notification;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.notification.dto.NotificationResponse;
import com.example.task_manager.notification.dto.UnreadNotificationCountResponse;
import com.example.task_manager.notification.entity.NotificationEntity;
import com.example.task_manager.notification.entity.NotificationType;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {

  private final NotificationRepository notificationRepository;
  private final UserRepository userRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final TeamRepository teamRepository;
  private final TaskRepository taskRepository;
  private final ProjectRepository projectRepository;

  @Transactional
  public void createFromActivity(ActivityEventEntity event) {
    Map<UUID, UserEntity> recipients = resolveRecipients(event);

    recipients.values().stream()
        .filter(recipient -> event.getUser() == null || !recipient.getId().equals(event.getUser().getId()))
        .map(recipient -> buildNotification(event, recipient))
        .forEach(notificationRepository::save);
  }

  @Transactional(readOnly = true)
  public PageResponse<NotificationResponse> getInbox(String recipientEmail, Pageable pageable) {
    Page<NotificationEntity> page = notificationRepository.findInbox(recipientEmail, pageable);

    return new PageResponse<>(
        page.map(this::toResponse).getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.isFirst(),
        page.isLast());
  }

  @Transactional(readOnly = true)
  public UnreadNotificationCountResponse getUnreadCount(String recipientEmail) {
    return new UnreadNotificationCountResponse(notificationRepository.countUnread(recipientEmail));
  }

  @Transactional
  public NotificationResponse markRead(UUID notificationId, String recipientEmail) {
    NotificationEntity notification = notificationRepository.findOwned(notificationId, recipientEmail)
        .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));

    if (notification.getReadAt() == null) {
      notification.setReadAt(Instant.now());
    }

    return toResponse(notification);
  }

  @Transactional
  public UnreadNotificationCountResponse markAllRead(String recipientEmail) {
    UserEntity recipient = getUserByEmail(recipientEmail);
    notificationRepository.markAllRead(recipient.getId(), Instant.now());
    return getUnreadCount(recipientEmail);
  }

  private Map<UUID, UserEntity> resolveRecipients(ActivityEventEntity event) {
    Map<UUID, UserEntity> recipients = new LinkedHashMap<>();
    ActivityEventDetails details = event.getDetails();

    if (details != null && details.subjectUser() != null) {
      userRepository.findById(details.subjectUser().id())
          .ifPresent(user -> addRecipient(recipients, user));
    }

    if (event.getTaskId() != null) {
      taskRepository.findById(event.getTaskId())
          .ifPresent(task -> addTaskRecipients(recipients, task));
      return recipients;
    }

    if (event.getProjectId() != null) {
      projectRepository.findById(event.getProjectId())
          .ifPresent(project -> addProjectRecipients(recipients, project));
      return recipients;
    }

    if (shouldNotifyTeamMembers(event.getEventType())) {
      teamMemberRepository.findMembersByTeamId(event.getTeamId()).stream()
          .map(TeamMemberEntity::getUser)
          .forEach(user -> addRecipient(recipients, user));
    }

    return recipients;
  }

  private void addTaskRecipients(Map<UUID, UserEntity> recipients, TaskEntity task) {
    addRecipient(recipients, task.getAssignee());
    addRecipient(recipients, task.getSupport());
  }

  private void addProjectRecipients(Map<UUID, UserEntity> recipients, ProjectEntity project) {
    addRecipient(recipients, project.getOwner());
    addRecipient(recipients, project.getCreatedBy());
  }

  private void addRecipient(Map<UUID, UserEntity> recipients, UserEntity user) {
    if (user != null) {
      recipients.putIfAbsent(user.getId(), user);
    }
  }

  private boolean shouldNotifyTeamMembers(ActivityEventType eventType) {
    return List.of(
        ActivityEventType.TEAM_DELETED,
        ActivityEventType.TEAM_OWNERSHIP_TRANSFERRED).contains(eventType);
  }

  private NotificationEntity buildNotification(ActivityEventEntity event, UserEntity recipient) {
    NotificationEntity notification = new NotificationEntity();
    notification.setRecipient(recipient);
    notification.setActor(event.getUser());
    notification.setActivityEvent(event);
    notification.setType(resolveType(event));
    NotificationCopy copy = buildNotificationCopy(event, recipient);
    notification.setTitle(truncate(copy.title(), 120));
    notification.setBody(copy.body());
    notification.setTargetPath(resolveTargetPath(event));
    notification.setTeamId(event.getTeamId());
    notification.setProjectId(event.getProjectId());
    notification.setTaskId(event.getTaskId());
    return notification;
  }

  private NotificationType resolveType(ActivityEventEntity event) {
    if (event.getTaskId() != null) {
      return NotificationType.TASK;
    }

    if (event.getProjectId() != null) {
      return NotificationType.PROJECT;
    }

    return NotificationType.TEAM;
  }

  private NotificationCopy buildNotificationCopy(ActivityEventEntity event, UserEntity recipient) {
    ActivityEventDetails details = event.getDetails();
    String actorName = actorName(event);
    String team = label(details == null ? null : details.team(), "this team");
    String project = label(details == null ? null : details.project(), "this project");
    String task = label(details == null ? null : details.task(), "this task");
    boolean recipientIsSubject = isSubjectRecipient(details, recipient);

    return switch (event.getEventType()) {
      case TEAM_MEMBER_ADDED -> new NotificationCopy(
          recipientIsSubject ? "You were added to a team" : "Team member added",
          recipientIsSubject
              ? "%s added you to %s as %s.".formatted(actorName, team, roleName(details == null ? null : details.to()))
              : "%s added %s to %s.".formatted(actorName, targetName(details), team));
      case TEAM_MEMBER_REMOVED -> new NotificationCopy(
          recipientIsSubject ? "You were removed from a team" : "Team member removed",
          recipientIsSubject
              ? "%s removed you from %s.".formatted(actorName, team)
              : "%s removed %s from %s.".formatted(actorName, targetName(details), team));
      case TEAM_MEMBER_ROLE_CHANGED -> new NotificationCopy(
          recipientIsSubject ? "Your team role changed" : "Team role changed",
          recipientIsSubject
              ? "%s changed your role in %s to %s.".formatted(actorName, team,
                  roleName(details == null ? null : details.to()))
              : "%s changed %s's role in %s to %s.".formatted(actorName, targetName(details), team,
                  roleName(details == null ? null : details.to())));
      case TEAM_OWNERSHIP_TRANSFERRED -> new NotificationCopy(
          recipientIsSubject ? "You are now the team owner" : "Team ownership transferred",
          recipientIsSubject
              ? "%s transferred ownership of %s to you.".formatted(actorName, team)
              : "%s transferred ownership of %s.".formatted(actorName, team));
      case TEAM_CREATED -> throw new UnsupportedOperationException("Unimplemented case: " + event.getEventType());
      case TEAM_UPDATED -> new NotificationCopy(
          "Team details updated",
          "%s updated %s%s.".formatted(actorName, team, changedFieldsSuffix(details)));
      case TEAM_DELETED -> new NotificationCopy(
          "Team archived",
          "%s archived %s.".formatted(actorName, team));

      case PROJECT_CREATED -> new NotificationCopy(
          "New project created",
          "%s created %s in %s.".formatted(actorName, project, team));
      case PROJECT_UPDATED -> new NotificationCopy(
          "Project details updated",
          "%s updated %s%s.".formatted(actorName, project, changedFieldsSuffix(details)));
      case PROJECT_STATUS_CHANGED -> new NotificationCopy(
          "Project status changed",
          "%s moved %s to %s.".formatted(actorName, project, statusName(details == null ? null : details.to())));
      case PROJECT_DELETED -> new NotificationCopy(
          "Project archived",
          "%s archived %s.".formatted(actorName, project));

      case TASK_CREATED -> new NotificationCopy(
          recipientIsSubject ? "New task assigned to you" : "New task created",
          recipientIsSubject
              ? "%s assigned you to %s in %s.".formatted(actorName, task, project)
              : "%s created %s in %s.".formatted(actorName, task, project));
      case TASK_ASSIGNEE_CHANGED -> new NotificationCopy(
          recipientIsSubject ? "Task assigned to you" : "Task assignee changed",
          recipientIsSubject
              ? "%s assigned %s to you.".formatted(actorName, task)
              : "%s changed the assignee for %s.".formatted(actorName, task));
      case TASK_SUPPORT_ASSIGNED, TASK_SUPPORT_CHANGED -> new NotificationCopy(
          recipientIsSubject ? "You were added as support" : "Task support changed",
          recipientIsSubject
              ? "%s added you as support on %s.".formatted(actorName, task)
              : "%s updated support on %s.".formatted(actorName, task));
      case TASK_SUPPORT_REMOVED -> new NotificationCopy(
          recipientIsSubject ? "You were removed from support" : "Task support removed",
          recipientIsSubject
              ? "%s removed you from support on %s.".formatted(actorName, task)
              : "%s removed support from %s.".formatted(actorName, task));
      case TASK_COMMENTED -> new NotificationCopy(
          "New comment on " + task,
          "%s commented: %s".formatted(actorName, truncate(event.getMessage(), 180)));
      case TASK_STATUS_CHANGED -> new NotificationCopy(
          "Task status changed",
          "%s moved %s to %s.".formatted(actorName, task, statusName(details == null ? null : details.to())));
      case TASK_UPDATED -> new NotificationCopy(
          "Task details updated",
          "%s updated %s%s.".formatted(actorName, task, changedFieldsSuffix(details)));
      case TASK_DELETED -> new NotificationCopy(
          "Task archived",
          "%s archived %s.".formatted(actorName, task));

      default -> throw new IllegalArgumentException("Unexpected value: " + event.getEventType());
    };
  }

  private String actorName(ActivityEventEntity event) {
    if (event.getUser() == null) {
      return "Someone";
    }

    return event.getUser().getFullName();
  }

  private String label(ActivityEventDetails.ActivityReference reference, String fallback) {
    if (reference == null || reference.label() == null || reference.label().isBlank()) {
      return fallback;
    }

    return reference.label();
  }

  private String targetName(ActivityEventDetails details) {
    if (details == null) {
      return "a teammate";
    }

    if (details.subjectUser() != null && details.subjectUser().label() != null) {
      return details.subjectUser().label();
    }

    if (details.target() != null && !details.target().isBlank()) {
      return details.target();
    }

    return "a teammate";
  }

  private boolean isSubjectRecipient(ActivityEventDetails details, UserEntity recipient) {
    return details != null
        && details.subjectUser() != null
        && recipient != null
        && recipient.getId().equals(details.subjectUser().id());
  }

  private String changedFieldsSuffix(ActivityEventDetails details) {
    if (details == null || details.changes() == null || details.changes().isEmpty()) {
      return "";
    }

    String fields = details.changes().stream()
        .map(ActivityEventDetails.ActivityChange::label)
        .filter(label -> label != null && !label.isBlank())
        .distinct()
        .limit(3)
        .reduce((left, right) -> left + ", " + right)
        .orElse("");

    return fields.isBlank() ? "" : " (" + fields + ")";
  }

  private String roleName(String role) {
    if (role == null || role.isBlank()) {
      return "member";
    }

    return role.replace("_", " ").toLowerCase();
  }

  private String statusName(String status) {
    if (status == null || status.isBlank()) {
      return "a new status";
    }

    String normalized = status.replace("_", " ").toLowerCase();
    return normalized.substring(0, 1).toUpperCase() + normalized.substring(1);
  }

  private String truncate(String value, int maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }

    return value.substring(0, maxLength - 1).trim() + "...";
  }

  private String resolveTargetPath(ActivityEventEntity event) {
    if (event.getTaskId() != null) {
      return taskRepository.findById(event.getTaskId())
          .map(task -> "/teams/%s/projects/%s/tasks/%d".formatted(
              task.getProject().getTeam().getKey(), task.getProject().getKey(), task.getTaskNumber()))
          .orElse("/teams");
    }

    if (event.getProjectId() != null) {
      return projectRepository.findById(event.getProjectId())
          .map(project -> "/teams/%s/projects/%s".formatted(project.getTeam().getKey(), project.getKey()))
          .orElse("/teams");
    }

    return teamRepository.findById(event.getTeamId())
        .map(team -> "/teams/%s%s".formatted(team.getKey(),
            isMembershipEvent(event.getEventType()) ? "/members" : ""))
        .orElse("/teams");
  }

  private boolean isMembershipEvent(ActivityEventType eventType) {
    return List.of(
        ActivityEventType.TEAM_MEMBER_ADDED,
        ActivityEventType.TEAM_MEMBER_REMOVED,
        ActivityEventType.TEAM_MEMBER_ROLE_CHANGED,
        ActivityEventType.TEAM_OWNERSHIP_TRANSFERRED).contains(eventType);
  }

  private NotificationResponse toResponse(NotificationEntity entity) {
    NotificationResponse.User actor = entity.getActor() == null
        ? null
        : new NotificationResponse.User(
            entity.getActor().getId(),
            entity.getActor().getFirstName(),
            entity.getActor().getLastName(),
            entity.getActor().getEmail());

    return new NotificationResponse(
        entity.getId(),
        entity.getType(),
        entity.getActivityEvent() == null ? null : entity.getActivityEvent().getEventType(),
        entity.getTitle(),
        entity.getBody(),
        entity.getActivityEvent() == null ? entity.getTargetPath() : resolveTargetPath(entity.getActivityEvent()),
        entity.getTeamId(),
        entity.getProjectId(),
        entity.getTaskId(),
        actor,
        entity.getReadAt() != null,
        entity.getReadAt(),
        entity.getCreatedAt());
  }

  private UserEntity getUserByEmail(String email) {
    return userRepository.findByEmailIgnoreCase(email)
        .orElseThrow(() -> new ResourceNotFoundException("User not found"));
  }

  private record NotificationCopy(String title, String body) {
  }
}
