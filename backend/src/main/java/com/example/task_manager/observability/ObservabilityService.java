package com.example.task_manager.observability;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.activity.ActivityEventRepository;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.observability.dto.AuditLogResponse;
import com.example.task_manager.observability.dto.ProjectInsightsResponse;
import com.example.task_manager.observability.dto.SystemEventResponse;
import com.example.task_manager.observability.dto.TeamInsightsResponse;
import com.example.task_manager.observability.entity.AuditAction;
import com.example.task_manager.observability.entity.AuditLogEntity;
import com.example.task_manager.observability.entity.KpiSnapshotEntity;
import com.example.task_manager.observability.entity.MetricScope;
import com.example.task_manager.observability.entity.MetricSnapshotEntity;
import com.example.task_manager.observability.entity.SystemEventEntity;
import com.example.task_manager.observability.entity.SystemEventSeverity;
import com.example.task_manager.project.ProjectRepository;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.project.entity.ProjectStatus;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;

import lombok.RequiredArgsConstructor;

/**
 * Owns audit logging, operational events, and query-friendly analytics.
 */
@Service
@RequiredArgsConstructor
public class ObservabilityService {
  private static final Duration INSIGHT_WINDOW = Duration.ofDays(7);

  private final AuditLogRepository auditLogRepository;
  private final SystemEventRepository systemEventRepository;
  private final MetricSnapshotRepository metricSnapshotRepository;
  private final KpiSnapshotRepository kpiSnapshotRepository;
  private final ActivityEventRepository activityEventRepository;
  private final TaskRepository taskRepository;
  private final ProjectRepository projectRepository;
  private final TeamRepository teamRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final UserRepository userRepository;

  @Transactional
  public void recordFromActivity(ActivityEventEntity event) {
    AuditLogEntity audit = new AuditLogEntity();
    audit.setTeamId(event.getTeamId());
    audit.setProjectId(event.getProjectId());
    audit.setTaskId(event.getTaskId());
    audit.setEntityType(event.getEntityType());
    audit.setEntityId(event.getEntityId());
    audit.setAction(toAuditAction(event.getEventType()));
    audit.setEventType(event.getEventType());
    audit.setActor(event.getUser());
    audit.setSummary(event.getMessage());
    audit.setMetadata(event.getDetails());

    auditLogRepository.save(audit);

    if (shouldPromoteToSystemEvent(event.getEventType())) {
      recordSystemEvent(
          SystemEventSeverity.INFO,
          "DOMAIN",
          event.getEventType().name(),
          "ActivityEventService",
          event.getTeamId(),
          event.getProjectId(),
          event.getTaskId(),
          event.getMessage(),
          event.getUser(),
          event.getDetails());
    }

    if (event.getProjectId() != null) {
      snapshotProjectMetrics(event.getProjectId());
    }

    snapshotTeamMetrics(event.getTeamId());
  }

  @Transactional
  public SystemEventEntity recordSystemEvent(
      SystemEventSeverity severity,
      String category,
      String eventName,
      String source,
      UUID teamId,
      UUID projectId,
      UUID taskId,
      String message,
      UserEntity actor,
      ActivityEventDetails context) {

    SystemEventEntity event = new SystemEventEntity();
    event.setSeverity(severity);
    event.setCategory(category);
    event.setEventName(eventName);
    event.setSource(source);
    event.setTeamId(teamId);
    event.setProjectId(projectId);
    event.setTaskId(taskId);
    event.setMessage(message);
    event.setActor(actor);
    event.setContext(context);

    return systemEventRepository.save(event);
  }

  @Transactional(readOnly = true)
  public TeamInsightsResponse getTeamInsights(String teamKey, Authentication authentication) {
    TeamEntity team = validateCanReadTeamObservability(teamKey, authentication);
    UUID teamId = team.getId();

    Instant now = Instant.now();
    Instant since = now.minus(INSIGHT_WINDOW);

    long totalTasks = taskRepository.countByProjectTeamIdAndDeletedAtIsNull(teamId);
    long done = taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.DONE);
    long cancelled = taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.CANCELLED);
    long overdueTasks = taskRepository.countOverdueOpenTasks(teamId, now, List.of(TaskStatus.DONE, TaskStatus.CANCELLED));
    long totalMembers = teamMemberRepository.countByTeamId(teamId);
    long totalProjects = projectRepository.countByTeamIdAndDeletedAtIsNull(teamId);
    long activeProjects = projectRepository.countByTeamIdAndStatusAndDeletedAtIsNull(teamId, ProjectStatus.ACTIVE);
    long completedProjects = projectRepository.countByTeamIdAndStatusAndDeletedAtIsNull(teamId, ProjectStatus.COMPLETED);

    TeamInsightsResponse.MembershipMetrics membershipMetrics = new TeamInsightsResponse.MembershipMetrics(
        totalMembers,
        teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.OWNER),
        teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.ADMIN),
        teamMemberRepository.countByTeamIdAndRole(teamId, TeamRole.MEMBER));

    TeamInsightsResponse.TaskMetrics taskMetrics = new TeamInsightsResponse.TaskMetrics(
        totalTasks,
        taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.TODO),
        taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.IN_PROGRESS),
        taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.IN_REVIEW),
        taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.ON_HOLD),
        done,
        cancelled,
        overdueTasks,
        taskRepository.countByProjectTeamIdAndPriorityAndDeletedAtIsNull(teamId, TaskPriority.HIGH),
        taskRepository.countByProjectTeamIdAndPriorityAndDeletedAtIsNull(teamId, TaskPriority.CRITICAL));

    long completedProjectsLast7Days = projectRepository
        .countByTeamIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(teamId, ProjectStatus.COMPLETED, since);

    TeamInsightsResponse.ProjectMetrics projectMetrics = new TeamInsightsResponse.ProjectMetrics(
        totalProjects,
        activeProjects,
        projectRepository.countByTeamIdAndStatusAndDeletedAtIsNull(teamId, ProjectStatus.ON_HOLD),
        completedProjects,
        completedProjectsLast7Days,
        totalProjects == 0 ? 0 : roundPercent((double) completedProjects / totalProjects * 100));

    long completedLast7Days = taskRepository
        .countByProjectTeamIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(teamId, TaskStatus.DONE, since);

    TeamInsightsResponse.FlowMetrics flowMetrics = new TeamInsightsResponse.FlowMetrics(
        completedLast7Days,
        totalTasks == 0 ? 0 : roundPercent((double) done / totalTasks * 100),
        averageCycleTimeHours(teamId));

    TeamInsightsResponse.ActivityMetrics activityMetrics = new TeamInsightsResponse.ActivityMetrics(
        activityEventRepository.countByTeamIdAndCreatedAtAfter(teamId, since),
        auditLogRepository.countByTeamIdAndOccurredAtAfter(teamId, since),
        systemEventRepository.countByTeamIdAndOccurredAtAfter(teamId, since));

    long openTasks = Math.max(0, totalTasks - done - cancelled);
    TeamInsightsResponse.HealthMetrics healthMetrics = new TeamInsightsResponse.HealthMetrics(
        openTasks,
        overdueTasks,
        totalMembers == 0 ? 0 : roundPercent((double) openTasks / totalMembers),
        totalMembers == 0 ? 0 : roundPercent((double) activeProjects / totalMembers));

    return new TeamInsightsResponse(
        teamId,
        now,
        membershipMetrics,
        taskMetrics,
        projectMetrics,
        flowMetrics,
        activityMetrics,
        healthMetrics);
  }

  @Transactional(readOnly = true)
  public PageResponse<AuditLogResponse> getAuditLogs(
      String teamKey,
      Pageable pageable,
      Authentication authentication) {

    TeamEntity team = validateCanReadTeamObservability(teamKey, authentication);

    Page<AuditLogEntity> page = auditLogRepository.findByTeamId(team.getId(), pageable);

    return toPageResponse(page, this::toAuditLogResponse);
  }

  @Transactional(readOnly = true)
  public ProjectInsightsResponse getProjectInsights(
      String teamKey,
      String projectKey,
      Authentication authentication) {

    ProjectEntity project = validateCanReadProjectObservability(teamKey, projectKey, authentication);
    UUID teamId = project.getTeam().getId();
    UUID projectId = project.getId();

    Instant now = Instant.now();
    Instant since = now.minus(INSIGHT_WINDOW);

    long totalTasks = taskRepository.countByProjectIdAndDeletedAtIsNull(projectId);
    long done = taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.DONE);

    ProjectInsightsResponse.TaskMetrics taskMetrics = new ProjectInsightsResponse.TaskMetrics(
        totalTasks,
        taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.TODO),
        taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.IN_PROGRESS),
        taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.IN_REVIEW),
        taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.ON_HOLD),
        done,
        taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.CANCELLED),
        taskRepository.countOverdueOpenTasksByProject(projectId, now, List.of(TaskStatus.DONE, TaskStatus.CANCELLED)),
        taskRepository.countByProjectIdAndPriorityAndDeletedAtIsNull(projectId, TaskPriority.HIGH),
        taskRepository.countByProjectIdAndPriorityAndDeletedAtIsNull(projectId, TaskPriority.CRITICAL));

    long completedLast7Days = taskRepository
        .countByProjectIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(projectId, TaskStatus.DONE, since);

    ProjectInsightsResponse.FlowMetrics flowMetrics = new ProjectInsightsResponse.FlowMetrics(
        completedLast7Days,
        totalTasks == 0 ? 0 : roundPercent((double) done / totalTasks * 100),
        averageProjectCycleTimeHours(projectId));

    ProjectInsightsResponse.ActivityMetrics activityMetrics = new ProjectInsightsResponse.ActivityMetrics(
        activityEventRepository.countByProjectIdAndCreatedAtAfter(projectId, since),
        auditLogRepository.countByProjectIdAndOccurredAtAfter(projectId, since),
        systemEventRepository.countByProjectIdAndOccurredAtAfter(projectId, since));

    ProjectInsightsResponse.HealthMetrics healthMetrics = new ProjectInsightsResponse.HealthMetrics(
        project.getPlannedDueDate() != null
            && project.getActualCompletionDate() == null
            && project.getPlannedDueDate().isBefore(now),
        project.getPlannedDueDate() == null ? 0 : ChronoUnit.DAYS.between(now, project.getPlannedDueDate()),
        project.getActualCompletionDate() != null
            && project.getPlannedDueDate() != null
            && !project.getActualCompletionDate().isAfter(project.getPlannedDueDate()));

    return new ProjectInsightsResponse(
        teamId,
        projectId,
        project.getStatus(),
        project.getPlannedStartDate(),
        project.getPlannedDueDate(),
        project.getActualStartDate(),
        project.getActualCompletionDate(),
        now,
        taskMetrics,
        flowMetrics,
        activityMetrics,
        healthMetrics);
  }

  @Transactional(readOnly = true)
  public PageResponse<SystemEventResponse> getSystemEvents(
      String teamKey,
      Pageable pageable,
      Authentication authentication) {

    TeamEntity team = validateCanReadTeamObservability(teamKey, authentication);

    Page<SystemEventEntity> page = systemEventRepository.findByTeamId(team.getId(), pageable);

    return toPageResponse(page, this::toSystemEventResponse);
  }

  @Transactional(readOnly = true)
  public PageResponse<AuditLogResponse> getProjectAuditLogs(
      String teamKey,
      String projectKey,
      Pageable pageable,
      Authentication authentication) {

    ProjectEntity project = validateCanReadProjectObservability(teamKey, projectKey, authentication);

    Page<AuditLogEntity> page = auditLogRepository.findByProjectId(project.getId(), pageable);

    return toPageResponse(page, this::toAuditLogResponse);
  }

  @Transactional(readOnly = true)
  public PageResponse<SystemEventResponse> getProjectSystemEvents(
      String teamKey,
      String projectKey,
      Pageable pageable,
      Authentication authentication) {

    ProjectEntity project = validateCanReadProjectObservability(teamKey, projectKey, authentication);

    Page<SystemEventEntity> page = systemEventRepository.findByProjectId(project.getId(), pageable);

    return toPageResponse(page, this::toSystemEventResponse);
  }

  private double averageCycleTimeHours(UUID teamId) {
    List<TaskEntity> completedTasks = taskRepository
        .findTop500ByProjectTeamIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
            teamId,
            TaskStatus.DONE);

    return completedTasks.stream()
        .mapToLong(task -> Duration.between(task.getActualStartDate(), task.getActualCompletionDate()).toMinutes())
        .average()
        .stream()
        .map(minutes -> Math.round((minutes / 60.0) * 100.0) / 100.0)
        .findFirst()
        .orElse(0);
  }

  private double averageProjectCycleTimeHours(UUID projectId) {
    List<TaskEntity> completedTasks = taskRepository
        .findTop500ByProjectIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
            projectId,
            TaskStatus.DONE);

    return completedTasks.stream()
        .mapToLong(task -> Duration.between(task.getActualStartDate(), task.getActualCompletionDate()).toMinutes())
        .average()
        .stream()
        .map(minutes -> Math.round((minutes / 60.0) * 100.0) / 100.0)
        .findFirst()
        .orElse(0);
  }

  private AuditAction toAuditAction(ActivityEventType eventType) {
    return switch (eventType) {
      case TEAM_CREATED, PROJECT_CREATED, TASK_CREATED -> AuditAction.CREATE;
      case TEAM_DELETED, PROJECT_DELETED, TASK_DELETED -> AuditAction.DELETE;
      case PROJECT_STATUS_CHANGED, TASK_STATUS_CHANGED -> AuditAction.STATUS_CHANGE;
      case TASK_ASSIGNEE_CHANGED, TASK_SUPPORT_ASSIGNED, TASK_SUPPORT_CHANGED, TASK_SUPPORT_REMOVED ->
        AuditAction.ASSIGNMENT_CHANGE;
      case TASK_COMMENTED -> AuditAction.COMMENT;
      case TEAM_MEMBER_ADDED, TEAM_MEMBER_REMOVED, TEAM_MEMBER_ROLE_CHANGED -> AuditAction.MEMBERSHIP_CHANGE;
      case TEAM_OWNERSHIP_TRANSFERRED -> AuditAction.OWNERSHIP_TRANSFER;
      case TEAM_UPDATED, PROJECT_UPDATED, TASK_UPDATED -> AuditAction.UPDATE;
    };
  }

  private boolean shouldPromoteToSystemEvent(ActivityEventType eventType) {
    // Keep system events high-signal. Routine collaboration changes already
    // live in activity and audit logs; this stream is for operational review.
    return switch (eventType) {
      case TEAM_DELETED, PROJECT_DELETED, TASK_DELETED, TEAM_OWNERSHIP_TRANSFERRED ->
        true;
      default -> false;
    };
  }

  private double roundPercent(double value) {
    return Math.round(value * 100.0) / 100.0;
  }

  private TeamEntity validateCanReadTeamObservability(String teamKey, Authentication authentication) {
    TeamEntity team = teamRepository.findByKey(teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

    if (isGlobalAdmin(authentication)) {
      return team;
    }

    TeamMemberEntity membership = requireMembership(team.getId(), authentication);

    if (team.getDeletedAt() != null &&
        membership.getRole() != TeamRole.OWNER &&
        membership.getRole() != TeamRole.ADMIN) {
      throw new ResourceNotFoundException("Team not found");
    }

    return team;
  }

  private ProjectEntity validateCanReadProjectObservability(
      String teamKey,
      String projectKey,
      Authentication authentication) {

    ProjectEntity project = projectRepository.findByKeyAndTeamKey(projectKey, teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

    validateCanReadTeamObservability(teamKey, authentication);

    if ((project.getDeletedAt() != null || project.getTeam().getDeletedAt() != null)
        && !isGlobalAdmin(authentication)) {
      TeamMemberEntity membership = requireMembership(project.getTeam().getId(), authentication);
      if (membership.getRole() != TeamRole.OWNER && membership.getRole() != TeamRole.ADMIN) {
        throw new ResourceNotFoundException("Project not found");
      }
    }

    return project;
  }

  private boolean isGlobalAdmin(Authentication authentication) {
    return authentication.getAuthorities().stream()
        .anyMatch(authority -> authority.getAuthority().equals("ROLE_SUPER_ADMIN")
            || authority.getAuthority().equals("ROLE_ADMIN"));
  }

  private TeamMemberEntity requireMembership(UUID teamId, Authentication authentication) {
    UserEntity requester = userRepository.findByEmail(authentication.getName())
        .orElseThrow(() -> new ResourceNotFoundException("User not found"));

    return teamMemberRepository.findByTeamIdAndUserId(teamId, requester.getId())
        .orElseThrow(() -> new ForbiddenException("User is not a team member"));
  }

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

  private void snapshotProjectMetrics(UUID projectId) {
    Instant now = Instant.now();
    long totalTasks = taskRepository.countByProjectIdAndDeletedAtIsNull(projectId);
    long doneTasks = taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.DONE);
    long cancelledTasks = taskRepository.countByProjectIdAndStatusAndDeletedAtIsNull(projectId, TaskStatus.CANCELLED);
    long openTasks = Math.max(0, totalTasks - doneTasks - cancelledTasks);
    long overdueTasks = taskRepository.countOverdueOpenTasksByProject(
        projectId,
        now,
        List.of(TaskStatus.DONE, TaskStatus.CANCELLED));
    double completionRate = totalTasks == 0 ? 0 : roundPercent((double) doneTasks / totalTasks * 100);

    saveProjectMetric(projectId, "project.tasks.total", totalTasks, "count");
    saveProjectMetric(projectId, "project.tasks.open", openTasks, "count");
    saveProjectMetric(projectId, "project.tasks.overdue", overdueTasks, "count");
    saveProjectKpi(projectId, "project.completion_rate", completionRate, "percent", now);
  }

  private void snapshotTeamMetrics(UUID teamId) {
    if (teamId == null) {
      return;
    }

    Instant now = Instant.now();
    long totalMembers = teamMemberRepository.countByTeamId(teamId);
    long totalTasks = taskRepository.countByProjectTeamIdAndDeletedAtIsNull(teamId);
    long doneTasks = taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.DONE);
    long cancelledTasks = taskRepository.countByProjectTeamIdAndStatusAndDeletedAtIsNull(teamId, TaskStatus.CANCELLED);
    long openTasks = Math.max(0, totalTasks - doneTasks - cancelledTasks);
    long overdueTasks = taskRepository.countOverdueOpenTasks(
        teamId,
        now,
        List.of(TaskStatus.DONE, TaskStatus.CANCELLED));
    long totalProjects = projectRepository.countByTeamIdAndDeletedAtIsNull(teamId);
    long completedProjects = projectRepository.countByTeamIdAndStatusAndDeletedAtIsNull(teamId, ProjectStatus.COMPLETED);
    double taskCompletionRate = totalTasks == 0 ? 0 : roundPercent((double) doneTasks / totalTasks * 100);
    double projectCompletionRate = totalProjects == 0 ? 0 : roundPercent((double) completedProjects / totalProjects * 100);

    saveTeamMetric(teamId, "team.members.total", totalMembers, "count");
    saveTeamMetric(teamId, "team.tasks.open", openTasks, "count");
    saveTeamMetric(teamId, "team.tasks.overdue", overdueTasks, "count");
    saveTeamMetric(teamId, "team.projects.total", totalProjects, "count");
    saveTeamKpi(teamId, "team.task_completion_rate", taskCompletionRate, "percent", now);
    saveTeamKpi(teamId, "team.project_completion_rate", projectCompletionRate, "percent", now);
  }

  private void saveProjectMetric(UUID projectId, String metricKey, double value, String unit) {
    MetricSnapshotEntity metric = new MetricSnapshotEntity();
    metric.setMetricKey(metricKey);
    metric.setScope(MetricScope.PROJECT);
    metric.setScopeId(projectId);
    metric.setValue(BigDecimal.valueOf(value));
    metric.setUnit(unit);

    metricSnapshotRepository.save(metric);
  }

  private void saveProjectKpi(UUID projectId, String kpiKey, double value, String unit, Instant now) {
    KpiSnapshotEntity kpi = new KpiSnapshotEntity();
    kpi.setKpiKey(kpiKey);
    kpi.setScope(MetricScope.PROJECT);
    kpi.setScopeId(projectId);
    kpi.setPeriodStart(now.minus(INSIGHT_WINDOW));
    kpi.setPeriodEnd(now);
    kpi.setValue(BigDecimal.valueOf(value));
    kpi.setUnit(unit);

    kpiSnapshotRepository.save(kpi);
  }

  private void saveTeamMetric(UUID teamId, String metricKey, double value, String unit) {
    MetricSnapshotEntity metric = new MetricSnapshotEntity();
    metric.setMetricKey(metricKey);
    metric.setScope(MetricScope.TEAM);
    metric.setScopeId(teamId);
    metric.setValue(BigDecimal.valueOf(value));
    metric.setUnit(unit);

    metricSnapshotRepository.save(metric);
  }

  private void saveTeamKpi(UUID teamId, String kpiKey, double value, String unit, Instant now) {
    KpiSnapshotEntity kpi = new KpiSnapshotEntity();
    kpi.setKpiKey(kpiKey);
    kpi.setScope(MetricScope.TEAM);
    kpi.setScopeId(teamId);
    kpi.setPeriodStart(now.minus(INSIGHT_WINDOW));
    kpi.setPeriodEnd(now);
    kpi.setValue(BigDecimal.valueOf(value));
    kpi.setUnit(unit);

    kpiSnapshotRepository.save(kpi);
  }

  private AuditLogResponse toAuditLogResponse(AuditLogEntity entity) {
    AuditLogResponse.User actor = new AuditLogResponse.User(
        entity.getActor().getId(),
        entity.getActor().getFirstName(),
        entity.getActor().getLastName(),
        entity.getActor().getEmail());

    return new AuditLogResponse(
        entity.getId(),
        entity.getTeamId(),
        entity.getProjectId(),
        entity.getTaskId(),
        entity.getEntityType(),
        entity.getEntityId(),
        entity.getAction(),
        entity.getEventType(),
        actor,
        entity.getSummary(),
        entity.getMetadata(),
        entity.getOccurredAt());
  }

  private SystemEventResponse toSystemEventResponse(SystemEventEntity entity) {
    SystemEventResponse.User actor = entity.getActor() == null
        ? null
        : new SystemEventResponse.User(
            entity.getActor().getId(),
            entity.getActor().getFirstName(),
            entity.getActor().getLastName(),
            entity.getActor().getEmail());

    return new SystemEventResponse(
        entity.getId(),
        entity.getSeverity(),
        entity.getCategory(),
        entity.getEventName(),
        entity.getSource(),
        entity.getTeamId(),
        entity.getProjectId(),
        entity.getTaskId(),
        entity.getMessage(),
        actor,
        entity.getContext(),
        entity.getOccurredAt());
  }
}
