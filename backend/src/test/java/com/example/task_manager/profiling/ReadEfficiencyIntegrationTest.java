package com.example.task_manager.profiling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.notification.NotificationRepository;
import com.example.task_manager.notification.entity.NotificationEntity;
import com.example.task_manager.notification.entity.NotificationType;
import com.example.task_manager.observability.entity.KpiSnapshotEntity;
import com.example.task_manager.observability.entity.MetricScope;
import com.example.task_manager.observability.entity.MetricSnapshotEntity;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

/**
 * Structural query budgets prevent per-row round trips without asserting machine-dependent timing.
 */
@Import(ActivityNotificationProfileTest.TraceConfiguration.class)
class ReadEfficiencyIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  @MockitoSpyBean NotificationRepository notificationRepository;
  private MockMvc mvc;
  private Workspace workspace;
  private String bearer;
  private final List<UUID> actors = new ArrayList<>();
  private final List<UUID> projects = new ArrayList<>();
  private UUID metricId;
  private UUID kpiId;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    transactions.executeWithoutResult(status -> seedDiverseHistory());
    bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @ValueSource(strings = {"team", "project", "task", "inbox"})
  void queryCountStaysBoundedAsPageSizeAndRelatedIdentitiesIncrease(String kind) throws Exception {
    String path =
        switch (kind) {
          case "team" -> teamPath() + "/activities";
          case "project" -> projectPath() + "/activities";
          case "task" -> workspace.taskPath() + "/activities";
          default -> "/api/notifications";
        };
    int small = queries(get(path).param("size", "1"));
    int large = queries(get(path).param("size", "20"));
    assertThat(large)
        .as("%s queries at 20 rows versus one row", kind)
        .isLessThanOrEqualTo(small + 2)
        .isLessThanOrEqualTo(12);
  }

  @Test
  void nonTaskProjectAndTeamReferencesAreLoadedOncePerPage() throws Exception {
    transactions.executeWithoutResult(
        status -> {
          for (int i = 0; i < 25; i++) {
            var actor = em.find(UserEntity.class, actors.get(i));
            var project = em.find(ProjectEntity.class, projects.get(i));
            event(actor, project, null, ActivityEventType.PROJECT_UPDATED);
            event(actor, null, null, ActivityEventType.TEAM_UPDATED);
          }
        });
    int history = queries(get(teamPath() + "/activities").param("size", "50"));
    int inbox = queries(get("/api/notifications").param("size", "50"));
    assertThat(history).isLessThanOrEqualTo(12);
    assertThat(inbox).isLessThanOrEqualTo(12);
    mvc.perform(get("/api/notifications").param("size", "50").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(125));
  }

  @Test
  void oldSnapshotsSurviveWhileCommentsStatusRoleAndArchiveProduceNoNewSnapshots()
      throws Exception {
    seedSnapshots();
    mvc.perform(get(teamPath() + "/insights/summary").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.total").value(51))
        .andExpect(jsonPath("$.tasks.done").value(0));
    mvc.perform(
            post(workspace.taskPath() + "/activities")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"A current comment\"}"))
        .andExpect(status().isOk());
    for (String status : List.of("IN_PROGRESS", "DONE"))
      mvc.perform(
              patch(workspace.taskPath() + "/status")
                  .header("Authorization", bearer)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"status\":\"" + status + "\"}"))
          .andExpect(status().isOk());
    mvc.perform(get(teamPath() + "/insights/summary").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.done").value(1));
    mvc.perform(get(projectPath() + "/insights/summary").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tasks.total").value(26))
        .andExpect(jsonPath("$.tasks.done").value(1));
    mvc.perform(
            patch(teamPath() + "/members/" + actors.getFirst() + "/role")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\"}"))
        .andExpect(status().isOk());
    String projectKey =
        jdbc.queryForObject(
            "select project_key from projects where id=?", String.class, projects.getFirst());
    mvc.perform(delete(teamPath() + "/projects/" + projectKey).header("Authorization", bearer))
        .andExpect(status().isNoContent());
    assertSnapshotsUnchanged();
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_logs where team_id=?",
                Long.class,
                workspace.team().getId()))
        .isGreaterThanOrEqualTo(6);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from notifications where team_id=?",
                Long.class,
                workspace.team().getId()))
        .isGreaterThan(75);
  }

  @Test
  void notificationFailureStillRollsBackTheBusinessChangeActivityAndAuditTogether()
      throws Exception {
    seedSnapshots();
    doThrow(new IllegalStateException("Injected notification failure"))
        .when(notificationRepository)
        .save(any(NotificationEntity.class));
    assertThatThrownBy(
            () ->
                mvc.perform(
                        patch(workspace.taskPath())
                            .header("Authorization", bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Must roll back\"}"))
                    .andReturn())
        .hasRootCauseInstanceOf(IllegalStateException.class)
        .hasStackTraceContaining("Injected notification failure");
    assertThat(
            jdbc.queryForObject(
                "select name from tasks where id=?", String.class, workspace.task().getId()))
        .isEqualTo("Original task");
    assertThat(
            jdbc.queryForObject(
                "select count(*) from activity_events where team_id=?",
                Long.class,
                workspace.team().getId()))
        .isEqualTo(75);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from audit_logs where team_id=?",
                Long.class,
                workspace.team().getId()))
        .isZero();
    assertThat(
            jdbc.queryForObject(
                "select count(*) from notifications where team_id=?",
                Long.class,
                workspace.team().getId()))
        .isEqualTo(75);
    assertSnapshotsUnchanged();
  }

  private int queries(MockHttpServletRequestBuilder request) throws Exception {
    var trace = new ArrayList<ProfileJdbcTrace.Sample>();
    ProfileJdbcTrace.CURRENT.set(trace);
    try {
      mvc.perform(request.header("Authorization", bearer)).andExpect(status().isOk());
      return trace.size();
    } finally {
      ProfileJdbcTrace.CURRENT.remove();
    }
  }

  private String teamPath() {
    return "/api/teams/" + workspace.team().getKey();
  }

  private String projectPath() {
    return teamPath() + "/projects/" + workspace.project().getKey();
  }

  private void seedSnapshots() {
    transactions.executeWithoutResult(
        status -> {
          var metric = new MetricSnapshotEntity();
          metric.setMetricKey("retained.metric");
          metric.setScope(MetricScope.TEAM);
          metric.setScopeId(workspace.team().getId());
          metric.setValue(BigDecimal.valueOf(9999));
          em.persist(metric);
          var kpi = new KpiSnapshotEntity();
          kpi.setKpiKey("retained.kpi");
          kpi.setScope(MetricScope.TEAM);
          kpi.setScopeId(workspace.team().getId());
          kpi.setValue(BigDecimal.valueOf(123));
          kpi.setPeriodStart(Instant.now().minusSeconds(3600));
          kpi.setPeriodEnd(Instant.now());
          em.persist(kpi);
          em.flush();
          metricId = metric.getId();
          kpiId = kpi.getId();
        });
  }

  private void assertSnapshotsUnchanged() {
    assertThat(
            jdbc.queryForObject(
                "select count(*) from metric_snapshots where scope_id=?",
                Long.class,
                workspace.team().getId()))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from kpi_snapshots where scope_id=?",
                Long.class,
                workspace.team().getId()))
        .isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select value from metric_snapshots where id=?", BigDecimal.class, metricId))
        .isEqualByComparingTo("9999");
    assertThat(
            jdbc.queryForObject(
                "select value from kpi_snapshots where id=?", BigDecimal.class, kpiId))
        .isEqualByComparingTo("123");
  }

  private void seedDiverseHistory() {
    var team = em.find(TeamEntity.class, workspace.team().getId());
    var owner = em.find(UserEntity.class, workspace.owner().getId());
    var base = em.find(ProjectEntity.class, workspace.project().getId());
    var primary = em.find(TaskEntity.class, workspace.task().getId());
    for (int i = 0; i < 25; i++) {
      var actor = new UserEntity();
      actor.setFirstName("Actor");
      actor.setLastName("Number " + i);
      actor.setEmail(UUID.randomUUID() + "@example.test");
      actor.setPassword("test-only");
      actor.setRole(UserRole.USER);
      em.persist(actor);
      actors.add(actor.getId());
      var member = new TeamMemberEntity();
      member.setTeam(team);
      member.setUser(actor);
      member.setAddedBy(owner);
      member.setRole(TeamRole.MEMBER);
      em.persist(member);
      var project = new ProjectEntity();
      project.setKey("P-" + UUID.randomUUID());
      project.setName("Project " + i);
      project.setTeam(team);
      project.setOwner(owner);
      project.setCreatedBy(owner);
      em.persist(project);
      projects.add(project.getId());
      event(actor, project, task(project, owner, actor, 1L), ActivityEventType.TASK_COMMENTED);
      event(actor, base, task(base, owner, actor, i + 2L), ActivityEventType.TASK_COMMENTED);
      event(actor, base, primary, ActivityEventType.TASK_COMMENTED);
      if (i == 0) primary.setSupport(actor);
    }
    em.flush();
  }

  private TaskEntity task(
      ProjectEntity project, UserEntity owner, UserEntity support, long number) {
    var task = new TaskEntity();
    task.setProject(project);
    task.setTaskNumber(number);
    task.setName("Task " + number);
    task.setAssignee(owner);
    task.setSupport(support);
    task.setCreatedBy(owner);
    task.setPriority(TaskPriority.MEDIUM);
    em.persist(task);
    return task;
  }

  private void event(
      UserEntity actor, ProjectEntity project, TaskEntity task, ActivityEventType type) {
    var event = new ActivityEventEntity();
    event.setTeamId(workspace.team().getId());
    event.setProjectId(project == null ? null : project.getId());
    event.setTaskId(task == null ? null : task.getId());
    event.setTask(task);
    event.setEntityType(
        task != null
            ? ActivityEntityType.TASK
            : project != null ? ActivityEntityType.PROJECT : ActivityEntityType.TEAM);
    event.setEntityId(
        task != null ? task.getId() : project != null ? project.getId() : workspace.team().getId());
    event.setEventType(type);
    event.setDetails(
        new ActivityEventDetails(List.of(), null, null, null, List.of(), null, null, null, null));
    event.setMessage("Historical sample");
    event.setUser(actor);
    em.persist(event);
    var notice = new NotificationEntity();
    notice.setRecipient(em.find(UserEntity.class, workspace.owner().getId()));
    notice.setActor(actor);
    notice.setActivityEvent(event);
    notice.setType(
        task != null
            ? NotificationType.TASK
            : project != null ? NotificationType.PROJECT : NotificationType.TEAM);
    notice.setTitle("Historical notice");
    notice.setBody("Retained contents");
    notice.setTargetPath("/teams");
    notice.setTeamId(workspace.team().getId());
    notice.setProjectId(project == null ? null : project.getId());
    notice.setTaskId(task == null ? null : task.getId());
    em.persist(notice);
  }
}
