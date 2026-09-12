package com.example.task_manager.task;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.example.task_manager.activity.ActivityEventRepository;
import com.example.task_manager.activity.ActivityEventService;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.config.security.Authorization.ProjectAuthorizationService;
import com.example.task_manager.config.security.Authorization.TeamAuthorizationService;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.task.dto.ChangeStatusRequest;
import com.example.task_manager.task.dto.CreateTaskRequest;
import com.example.task_manager.task.dto.CreateTaskCommentRequest;
import com.example.task_manager.task.dto.TaskActivityResponse;
import com.example.task_manager.task.dto.TaskResponse;
import com.example.task_manager.task.dto.TaskSearchRequest;
import com.example.task_manager.task.dto.UpdateTaskDetailsRequest;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.user.entity.UserEntity;

import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

/**
 * Handles business logic for tasks.
 */
@Service
@RequiredArgsConstructor
public class TaskService {

  private static final Set<String> ALLOWED_SORT_FIELDS = Set.of(
      "name",
      "priority",
      "status",
      "assignee",
      "support",
      "plannedStartDate",
      "plannedDueDate",
      "createdAt",
      "taskNumber",
      "updatedAt",
      "lastActivityAt");

  private final TaskRepository taskRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final ActivityEventRepository activityEventRepository;
  private final ActivityEventService activityEventService;
  private final GlobalAuthorizationService globalAuthorizationService;
  private final TeamAuthorizationService teamAuthorizationService;
  private final ProjectAuthorizationService projectAuthorizationService;

  /**
   * Creates a new task under a project
   * User must be Team Owner or Admin
   * Optionally add a support user.
   */
  @Transactional
  public TaskResponse createTask(
      String teamKey,
      String projectKey,
      CreateTaskRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());
    validateDates(request.plannedStartDate(), request.plannedDueDate());

    TeamMemberEntity assigneeMember = teamAuthorizationService.requireActiveMembership(team.getId(),
        request.assigneeId());

    TeamMemberEntity supportMember = new TeamMemberEntity();

    if (request.supportId() != null) {
      supportMember = teamAuthorizationService.requireActiveMembership(team.getId(), request.supportId());
      validateAssignment(team.getId(), request.assigneeId(), request.supportId());
    }

    Long taskNumber = project.getNextTaskNumber();

    TaskEntity task = new TaskEntity();
    task.setProject(project);
    task.setTaskNumber(taskNumber);
    task.setName(request.name().trim());
    task.setDescription(request.description());
    task.setStatus(TaskStatus.TODO);
    task.setPriority(request.priority());
    task.setPlannedStartDate(request.plannedStartDate());
    task.setPlannedDueDate(request.plannedDueDate());
    task.setCreatedBy(requester);
    task.setStatusChangedAt(Instant.now());

    task.setAssignee(assigneeMember.getUser());
    task.setSupport(request.supportId() == null
        ? null
        : supportMember.getUser());

    taskRepository.save(task);
    activityEventService.recordTaskEvent(
        task,
        requester,
        ActivityEventType.TASK_CREATED,
        buildTaskActivityDetails(
            List.of("name", "description", "status", "priority", "assignee"),
            null,
            null,
            task.getAssignee().getFullName(),
            buildTaskCreateChanges(task),
            task.getAssignee()),
        null);
    project.setNextTaskNumber(taskNumber + 1);

    return mapToResponse(task);
  }

  /**
   * Updates an existing task.
   * Only Owner and Admin can update the task
   * 
   */
  @Transactional
  public TaskResponse updateTask(
      String teamKey,
      String projectKey,
      Long taskNumber,
      UpdateTaskDetailsRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    String currentTitle = task.getName();
    String currentDescription = task.getDescription();
    TaskPriority currentPriority = task.getPriority();
    Instant currentPlannedStart = task.getPlannedStartDate();
    Instant currentPlannedDue = task.getPlannedDueDate();

    if (request.name() != null) {

      if (request.name().isBlank()) {
        throw new BadRequestInputException("Task name cannot be blank");
      }
      task.setName(request.name().trim());
    }

    if (request.description() != null) {
      task.setDescription(request.description().trim());
    }

    if (request.priority() != null) {
      task.setPriority(request.priority());
    }

    Instant newPlannedStart = request.plannedStartDate() != null
        ? request.plannedStartDate()
        : task.getPlannedStartDate();

    Instant newPlannedDue = request.plannedDueDate() != null
        ? request.plannedDueDate()
        : task.getPlannedDueDate();

    validateDates(newPlannedStart, newPlannedDue);

    task.setPlannedStartDate(newPlannedStart);
    task.setPlannedDueDate(newPlannedDue);

    TaskDetailsUpdateMessage updateMessage = buildTaskDetailsUpdateMessage(
        currentTitle,
        currentDescription,
        currentPriority == null ? null : currentPriority.name(),
        currentPlannedStart,
        currentPlannedDue,
        task.getName(),
        task.getDescription(),
        task.getPriority() == null ? null : task.getPriority().name(),
        task.getPlannedStartDate(),
        task.getPlannedDueDate());

    if (!updateMessage.fields().isEmpty()) {
      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_UPDATED,
          buildTaskActivityDetails(
              updateMessage.fields(),
              null,
              null,
              null,
              updateMessage.changes(),
              null),
          updateMessage.message());
    }

    return mapToResponse(task);
  }

  /**
   * Soft-deletes a task.
   * Only Owner and Admin can soft-delete task
   */
  @Transactional
  public void deleteTask(
      String teamKey,
      String projectKey,
      Long taskNumber,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    Instant now = Instant.now();

    task.setStatus(TaskStatus.DELETED);
    task.setStatusChangedAt(now);
    task.setDeletedAt(now);
    task.setDeletedBy(requester);

    activityEventService.recordTaskEvent(
        task,
        requester,
        ActivityEventType.TASK_DELETED,
        activityEventService.emptyDetails(),
        null);
  }

  /**
   * Retrieves tasks for a projects with support for:
   * - Search
   * - Filtering
   * - Sorting
   * - Pagination
   * - Role-based soft-delete visibility
   */
  @Transactional(readOnly = true)
  public PageResponse<TaskResponse> getTasks(
      String teamKey,
      String projectKey,
      TaskSearchRequest request,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());

    TeamEntity team = teamAuthorizationService.requireTeam(teamKey);
    boolean isGlobalAdmin = globalAuthorizationService.isGlobalAdmin(requester);
    boolean canViewDeleted = globalAuthorizationService.canViewDeleted(team, requester.getId(), isGlobalAdmin);

    pageable = request.all()
        ? Pageable.unpaged()
        : requireSortable(pageable);

    Specification<TaskEntity> spec = TaskSpecification.build(
        projectKey,
        request.search(),
        request.status(),
        request.priority(),
        request.assigneeId(),
        request.supportId(),
        request.overdue(),
        request.deletedFilter(),
        canViewDeleted);

    Page<TaskEntity> page = taskRepository.findAll(spec, pageable);

    return toPageResponse(page, this::mapToResponse);
  }

  /**
   * Returns a task by id.
   * Only Global Admin, Owner and Team Admin can view deleted task
   */
  @Transactional(readOnly = true)
  public TaskResponse getTaskById(
      String teamKey,
      String projectKey,
      Long taskNumber,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());

    boolean isGlobalAdmin = globalAuthorizationService.isGlobalAdmin(requester);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireTask(taskNumber, project.getId(), team.getId());

    validateCanReadTask(task, requester.getId(), isGlobalAdmin);

    return mapToResponse(task);
  }

  /**
   * Returns all user's task.
   * Assignee and Support
   */
  @Transactional(readOnly = true)
  public PageResponse<TaskResponse> getMyTasks(
      String requesterEmail,
      Pageable pageable) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    Page<TaskEntity> page = taskRepository.findMyTasks(requester.getId(),
        pageable);

    return toPageResponse(page, this::mapToResponse);
  }

  /**
   * Returns all user's task by project.
   * Assignee and Support
   */
  @Transactional(readOnly = true)
  public PageResponse<TaskResponse> getMyTasksByProject(
      String projectKey,
      String requesterEmail,
      Pageable pageable) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    Page<TaskEntity> page = taskRepository.findMyTasksByProject(projectKey, requester.getId(), pageable);

    return toPageResponse(page, this::mapToResponse);
  }

  /**
   * Returns all activity in a task
   */
  @Transactional(readOnly = true)
  public PageResponse<TaskActivityResponse> getTaskActivities(
      String teamKey,
      String projectKey,
      Long taskNumber,
      Pageable pageable,
      Authentication authentication) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(authentication.getName());

    boolean isGlobalAdmin = globalAuthorizationService.isGlobalAdmin(requester);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireTask(taskNumber, project.getId(), team.getId());

    validateCanReadTask(task, requester.getId(), isGlobalAdmin);

    Page<ActivityEventEntity> page = activityEventRepository.findByTaskId(task.getId(), pageable);

    return toPageResponse(page, activityEventService::toTaskActivitiesResponse);
  }

  /**
   * Change the status of a task
   * Only admin, owner, assignee and support can change status
   * 
   */
  @Transactional
  public TaskResponse changeStatus(
      String teamKey,
      String projectKey,
      Long taskNumber,
      ChangeStatusRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    validateCanChangeStatusAndUpdate(team.getId(), task, requester.getId());
    validateStatusTransition(task.getStatus(), request.status());

    TaskStatus current = task.getStatus();
    TaskStatus newStatus = request.status();

    if (newStatus == TaskStatus.IN_PROGRESS && task.getActualStartDate() == null) {
      task.setActualStartDate(Instant.now());
    }

    if (newStatus == TaskStatus.DONE) {
      task.setActualCompletionDate(Instant.now());
      task.setCompletedBy(requester);
    }

    if (current == TaskStatus.DONE && newStatus != TaskStatus.DONE) {
      task.setActualCompletionDate(null);
      task.setCompletedBy(null);
    }

    String message = "Status changed from " + current + " to " + newStatus;

    task.setStatus(newStatus);
    task.setStatusChangedAt(Instant.now());
    activityEventService.recordTaskEvent(
        task,
        requester,
        ActivityEventType.TASK_STATUS_CHANGED,
        buildTaskActivityDetails(
            List.of("status"),
            current.name(),
            newStatus != null ? newStatus.name() : null,
            null,
            List.of(activityEventService.change("status", "status", current, newStatus)),
            null),
        message);

    return mapToResponse(task);
  }

  /**
   * Change or Assign a task
   * Only admin and owner can change assignee
   */
  @Transactional
  public TaskResponse changeAssignee(
      String teamKey,
      String projectKey,
      Long taskNumber,
      UUID newAssigneeId,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    UserEntity currentAssignee = task.getAssignee();
    UserEntity currentSupport = task.getSupport();

    if (newAssigneeId.equals(currentAssignee.getId())) {
      return mapToResponse(task);
    }

    UserEntity newAssignee = teamAuthorizationService.requireActiveMembership(team.getId(), newAssigneeId).getUser();

    if (currentSupport != null && newAssignee.getId().equals(currentSupport.getId())) {

      task.setAssignee(newAssignee);
      task.setSupport(null);

      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_ASSIGNEE_CHANGED,
          buildTaskActivityDetails(
              List.of("assignee"),
              currentAssignee.getFullName(),
              newAssignee.getFullName(),
              newAssignee.getFullName(),
              List.of(activityEventService.change("assignee", "assignee", currentAssignee.getFullName(),
                  newAssignee.getFullName())),
              newAssignee),
          null);

      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_SUPPORT_REMOVED,
          buildTaskActivityDetails(
              List.of("support"),
              currentSupport.getFullName(),
              null,
              currentSupport.getFullName(),
              List.of(activityEventService.change("support", "support", currentSupport.getFullName(), null)),
              currentSupport),
          "Support removed (" + currentSupport.getFullName() + ") because the user became the assignee");

      return mapToResponse(task);
    }

    task.setAssignee(newAssignee);

    activityEventService.recordTaskEvent(
        task,
        requester,
        ActivityEventType.TASK_ASSIGNEE_CHANGED,
        buildTaskActivityDetails(
            List.of("assignee"),
            currentAssignee.getFullName(),
            newAssignee.getFullName(),
            newAssignee.getFullName(),
            List.of(activityEventService.change("assignee", "assignee", currentAssignee.getFullName(),
                newAssignee.getFullName())),
            newAssignee),
        null);

    return mapToResponse(task);
  }

  /**
   * Change support of a task
   * Only admin and owner can change support
   */
  @Transactional
  public TaskResponse changeSupport(
      String teamKey,
      String projectKey,
      Long taskNumber,
      UUID newSupportId,
      String requesterEmail) {
    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    teamAuthorizationService.validateManagerMembership(team.getId(), requester.getId());

    UserEntity currentAssignee = task.getAssignee();
    UserEntity currentSupport = task.getSupport();

    if (newSupportId == null) {

      if (currentSupport == null) {
        return mapToResponse(task);
      }

      task.setSupport(null);

      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_SUPPORT_REMOVED,
          buildTaskActivityDetails(
              List.of("support"),
              currentSupport.getFullName(),
              null,
              currentSupport.getFullName(),
              List.of(activityEventService.change("support", "support", currentSupport.getFullName(), null)),
              currentSupport),
          null);

      return mapToResponse(task);
    }

    // New Support is Assignee
    if (newSupportId.equals(currentAssignee.getId())) {
      throw new ConflictException("Support cannot be the same as assignee");
    }

    // New support is Current Support
    if (currentSupport != null &&
        newSupportId.equals(currentSupport.getId())) {
      return mapToResponse(task);
    }

    UserEntity newSupport = teamAuthorizationService.requireActiveMembership(team.getId(), newSupportId).getUser();

    task.setSupport(newSupport);

    // Assign new Support
    if (currentSupport == null) {
      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_SUPPORT_ASSIGNED,
          buildTaskActivityDetails(
              List.of("support"),
              null,
              newSupport.getFullName(),
              newSupport.getFullName(),
              List.of(activityEventService.change("support", "support", null, newSupport.getFullName())),
              newSupport),
          null);
    } else {
      activityEventService.recordTaskEvent(
          task,
          requester,
          ActivityEventType.TASK_SUPPORT_CHANGED,
          buildTaskActivityDetails(
              List.of("support"),
              currentSupport.getFullName(),
              newSupport.getFullName(),
              newSupport.getFullName(),
              List.of(activityEventService.change("support", "support", currentSupport.getFullName(),
                  newSupport.getFullName())),
              newSupport),
          null);
    }

    return mapToResponse(task);
  }

  /**
   * Add a progress update to a Task
   */
  @Transactional
  public TaskActivityResponse addTaskComment(
      String teamKey,
      String projectKey,
      Long taskNumber,
      CreateTaskCommentRequest request,
      String requesterEmail) {

    UserEntity requester = globalAuthorizationService.getUserByEmail(requesterEmail);

    TeamEntity team = teamAuthorizationService.requireActiveTeam(teamKey);

    ProjectEntity project = projectAuthorizationService.requireActiveProject(projectKey, team.getId());

    TaskEntity task = requireActiveTask(taskNumber, project.getId(), team.getId());

    validateCanChangeStatusAndUpdate(team.getId(), task, requester.getId());

    ActivityEventEntity activity = activityEventService.recordTaskComment(
        task,
        requester,
        request.message());

    return activityEventService.toTaskActivitiesResponse(activity);
  }

  // ********************
  // HELPERS
  // ********************

  private <T, R> PageResponse<R> toPageResponse(Page<T> page, Function<T, R> mapper) {
    return new PageResponse<>(
        page.map(mapper).getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.isFirst(),
        page.isLast());
  }

  private TaskResponse mapToResponse(TaskEntity task) {
    TaskResponse.TaskUserSummary assignedUser = new TaskResponse.TaskUserSummary(task.getAssignee().getId(),
        task.getAssignee().getFirstName(),
        task.getAssignee().getLastName(),
        task.getAssignee().getEmail());

    TaskResponse.TaskUserSummary supportUser = null;
    if (task.getSupport() != null) {
      supportUser = new TaskResponse.TaskUserSummary(task.getSupport().getId(),
          task.getSupport().getFirstName(),
          task.getSupport().getLastName(),
          task.getSupport().getEmail());
    }

    return new TaskResponse(
        task.getName(),
        task.getDescription(),
        task.getStatus(),
        task.getPriority(),
        assignedUser,
        supportUser,
        task.getTaskNumber(),
        task.getPlannedStartDate(),
        task.getPlannedDueDate(),
        task.getActualStartDate(),
        task.getActualCompletionDate(),
        task.getCreatedAt(),
        task.getUpdatedAt(),
        task.getLastActivityAt());
  }

  /**
   * Ensures task exists
   * Returns active task
   */
  private TaskEntity requireActiveTask(Long taskNumber, UUID projectId, UUID teamId) {
    return taskRepository.findByTaskNumberAndProjectIdAndProjectTeamIdAndDeletedAtIsNull(taskNumber, projectId, teamId)
        .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
  }

  /**
   * Ensure task exists
   * Returns task
   */
  private TaskEntity requireTask(Long taskNumber, UUID projectId, UUID teamId) {
    return taskRepository.findByTaskNumberAndProjectIdAndProjectTeamId(taskNumber, projectId, teamId)
        .orElseThrow(() -> new ResourceNotFoundException("Task not found"));
  }

  /*
   * Ensures sort request is sortable
   */
  private Pageable requireSortable(Pageable pageable) {

    for (Sort.Order order : pageable.getSort()) {
      if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
        throw new BadRequestInputException(
            "Invalid sort field: " + order.getProperty());
      }
    }

    return pageable;
  }

  /**
   * Checks if Start Date < Due Date
   */
  private void validateDates(Instant start, Instant due) {
    if (start == null || due == null) {
      throw new BadRequestInputException("Start date and due date are required");
    }

    if (due.isBefore(start)) {
      throw new ConflictException("Due date must be after start date");
    }
  }

  /**
   * Ensures User is Owner, Admin, Assignee, or Support
   */
  private void validateCanChangeStatusAndUpdate(UUID teamId, TaskEntity task, UUID userId) {
    TeamMemberEntity member = teamAuthorizationService.requireActiveMembership(teamId, userId);

    boolean allowed = task.getAssignee().getId().equals(userId) ||
        (task.getSupport() != null && task.getSupport().getId().equals(userId));

    if (!allowed && !teamAuthorizationService.canManageTeam(member)) {
      throw new ForbiddenException("Cannot change task status");
    }
  }

  /**
   * Ensures:
   * - Task status cannot be changed to its current value
   * - Task status cannot be set to todo
   */
  private void validateStatusTransition(TaskStatus current, TaskStatus next) {
    if (next == null) {
      throw new BadRequestInputException("Task status is required");
    }

    if (current == next) {
      throw new ConflictException("Task is already in this status");
    }

    if (next == TaskStatus.TODO && current != TaskStatus.TODO) {
      throw new BadRequestInputException("Cannot transition back to TODO");
    }
  }

  /**
   * Ensures:
   * - Assignee is not Support
   */
  private void validateAssignment(
      UUID teamId,
      UUID assigneeId,
      UUID supportId) {

    if (assigneeId.equals(supportId)) {
      throw new ConflictException("Assignee and support cannot be the same");
    }
  }

  /**
   * Ensures:
   * - User is able to read task
   * - User is Global admin or team member
   */
  private void validateCanReadTask(TaskEntity task, UUID requesterId, boolean isGlobalAdmin) {
    if (isGlobalAdmin) {
      return;
    }

    UUID teamId = task.getProject().getTeam().getId();
    TeamMemberEntity membership = teamMemberRepository.findByTeamIdAndUserId(teamId, requesterId)
        .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

    boolean deleted = task.getDeletedAt() != null || task.getProject().getDeletedAt() != null;
    if (deleted && !teamAuthorizationService.canManageTeam(membership)) {
      throw new ResourceNotFoundException("Task not found");
    }
  }

  private TaskDetailsUpdateMessage buildTaskDetailsUpdateMessage(
      String previousTitle,
      String previousDescription,
      String previousPriority,
      Instant previousPlannedStart,
      Instant previousPlannedDue,
      String newTitle,
      String newDescription,
      String newPriority,
      Instant newPlannedStart,
      Instant newPlannedDue) {

    List<String> changes = new ArrayList<>();
    List<ActivityEventDetails.ActivityChange> detailedChanges = new ArrayList<>();

    if (!java.util.Objects.equals(previousTitle, newTitle)) {
      changes.add("name");
      detailedChanges.add(activityEventService.change("name", "name", previousTitle, newTitle));
    }

    if (!java.util.Objects.equals(previousDescription, newDescription)) {
      changes.add("description");
      detailedChanges
          .add(activityEventService.change("description", "description", previousDescription, newDescription));
    }

    if (!java.util.Objects.equals(previousPriority, newPriority)) {
      changes.add("priority");
      detailedChanges.add(activityEventService.change("priority", "priority", previousPriority, newPriority));
    }

    if (!java.util.Objects.equals(previousPlannedStart, newPlannedStart)) {
      changes.add("planned start");
      detailedChanges
          .add(activityEventService.change("plannedStartDate", "planned start", previousPlannedStart, newPlannedStart));
    }

    if (!java.util.Objects.equals(previousPlannedDue, newPlannedDue)) {
      changes.add("planned due");
      detailedChanges
          .add(activityEventService.change("plannedDueDate", "planned due", previousPlannedDue, newPlannedDue));
    }

    if (changes.isEmpty()) {
      return new TaskDetailsUpdateMessage("Task details updated", List.of(), List.of());
    }

    return new TaskDetailsUpdateMessage(
        "Task details updated: " + String.join(", ", changes),
        changes,
        detailedChanges);
  }

  private record TaskDetailsUpdateMessage(
      String message,
      List<String> fields,
      List<ActivityEventDetails.ActivityChange> changes) {
  }

  private ActivityEventDetails buildTaskActivityDetails(
      List<String> fields,
      String from,
      String to,
      String target,
      List<ActivityEventDetails.ActivityChange> changes,
      UserEntity subjectUser) {
    return new ActivityEventDetails(
        fields,
        from,
        to,
        target,
        changes,
        null,
        null,
        null,
        subjectUser == null ? null : activityEventService.reference(subjectUser));
  }

  private List<ActivityEventDetails.ActivityChange> buildTaskCreateChanges(TaskEntity task) {
    List<ActivityEventDetails.ActivityChange> changes = new ArrayList<>();
    changes.add(activityEventService.change("name", "name", null, task.getName()));
    changes.add(activityEventService.change("description", "description", null, task.getDescription()));
    changes.add(activityEventService.change("status", "status", null, task.getStatus()));
    changes.add(activityEventService.change("priority", "priority", null, task.getPriority()));
    changes.add(activityEventService.change("assignee", "assignee", null, task.getAssignee().getFullName()));

    if (task.getSupport() != null) {
      changes.add(activityEventService.change("support", "support", null, task.getSupport().getFullName()));
    }

    if (task.getPlannedStartDate() != null) {
      changes.add(activityEventService.change("plannedStartDate", "planned start", null, task.getPlannedStartDate()));
    }

    if (task.getPlannedDueDate() != null) {
      changes.add(activityEventService.change("plannedDueDate", "planned due", null, task.getPlannedDueDate()));
    }

    return changes;
  }

}
