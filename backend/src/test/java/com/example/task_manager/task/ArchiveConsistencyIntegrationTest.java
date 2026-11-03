package com.example.task_manager.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.project.entity.ProjectStatus;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class ArchiveConsistencyIntegrationTest extends PostgresIntegrationTest {
  private static final Instant WORKFLOW_TIME = Instant.parse("2026-01-01T10:00:00Z");
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  private MockMvc mvc;
  private Workspace workspace;
  private String ownerAuthorization;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    ownerAuthorization = authorization(workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @EnumSource(value = TaskStatus.class, names = "DELETED", mode = EnumSource.Mode.EXCLUDE)
  void directTaskArchivePreservesWorkflowAndCompletion(TaskStatus taskStatus) throws Exception {
    setWorkflow(taskStatus, ProjectStatus.ACTIVE);
    archive("TASK");
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value(taskStatus.name()))
        .andExpect(jsonPath("$.deletedAt").isNotEmpty())
        .andExpect(jsonPath("$.deletedBy.id").value(workspace.owner().getId().toString()))
        .andExpect(jsonPath("$.readOnly").value(true));
    assertTaskWorkflow(taskStatus);
    assertListCount(tasksPath() + "?deletedFilter=ACTIVE", 0);
    assertListCount(tasksPath() + "?deletedFilter=DELETED&status=" + taskStatus.name(), 1);
    mvc.perform(get(tasksPath() + "/my-task").header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @ParameterizedTest
  @EnumSource(value = ProjectStatus.class, names = "DELETED", mode = EnumSource.Mode.EXCLUDE)
  void projectArchivePreservesProjectAndTaskWorkflow(ProjectStatus projectStatus) throws Exception {
    setWorkflow(TaskStatus.DONE, projectStatus);
    archive("PROJECT");
    mvc.perform(get(projectPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value(projectStatus.name()))
        .andExpect(jsonPath("$.readOnly").value(true));
    transactions.executeWithoutResult(
        status -> {
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          assertThat(project.getStatusChangedAt()).isEqualTo(WORKFLOW_TIME);
          assertThat(project.getActualStartDate()).isEqualTo(WORKFLOW_TIME);
          assertThat(project.getActualCompletionDate()).isEqualTo(WORKFLOW_TIME.plusSeconds(60));
          assertThat(project.getCompletedBy().getId()).isEqualTo(workspace.owner().getId());
          assertThat(project.getDeletedBy().getId()).isEqualTo(workspace.owner().getId());
          var task = em.find(TaskEntity.class, workspace.task().getId());
          assertThat(task.getDeletedAt()).isEqualTo(project.getDeletedAt());
          assertThat(task.getDeletedBy().getId()).isEqualTo(workspace.owner().getId());
        });
    assertTaskWorkflow(TaskStatus.DONE);
    assertListCount(teamPath() + "/projects?deletedFilter=ACTIVE", 0);
    assertListCount(
        teamPath() + "/projects?deletedFilter=DELETED&status=" + projectStatus.name(), 1);
  }

  @Test
  void teamCascadePreservesWorkflowAndRecordsArchiverForChildren() throws Exception {
    setWorkflow(TaskStatus.DONE, ProjectStatus.COMPLETED);
    archive("TEAM");
    assertTaskWorkflow(TaskStatus.DONE);
    transactions.executeWithoutResult(
        status -> {
          var team = em.find(TeamEntity.class, workspace.team().getId());
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          var task = em.find(TaskEntity.class, workspace.task().getId());
          assertThat(project.getStatus()).isEqualTo(ProjectStatus.COMPLETED);
          assertThat(project.getStatusChangedAt()).isEqualTo(WORKFLOW_TIME);
          assertThat(project.getCompletedBy().getId()).isEqualTo(workspace.owner().getId());
          assertThat(project.getActualCompletionDate()).isEqualTo(WORKFLOW_TIME.plusSeconds(60));
          assertThat(project.getDeletedAt()).isEqualTo(team.getDeletedAt());
          assertThat(task.getDeletedAt()).isEqualTo(team.getDeletedAt());
          assertThat(project.getDeletedBy().getId()).isEqualTo(workspace.owner().getId());
          assertThat(task.getDeletedBy().getId()).isEqualTo(workspace.owner().getId());
        });
  }

  @ParameterizedTest
  @ValueSource(strings = {"PROJECT", "TEAM"})
  void cascadeRetainsEarlierArchivesWithoutDuplicateTaskEvents(String level) throws Exception {
    archive("TASK");
    Instant original =
        transactions.execute(
            status -> em.find(TaskEntity.class, workspace.task().getId()).getDeletedAt());
    archive(level);
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          assertThat(task.getDeletedAt()).isEqualTo(original);
          assertThat(task.getDeletedBy().getId()).isEqualTo(workspace.owner().getId());
          assertThat(
                  em.createQuery(
                          "select count(e) from ActivityEventEntity e where e.taskId = :task and e.eventType = :type",
                          Long.class)
                      .setParameter("task", task.getId())
                      .setParameter("type", ActivityEventType.TASK_DELETED)
                      .getSingleResult())
              .isEqualTo(1);
        });
  }

  @ParameterizedTest
  @CsvSource({
    "TASK,OWNER",
    "TASK,ADMIN",
    "TASK,GLOBAL_ADMIN",
    "TASK,SUPER_ADMIN",
    "PROJECT,OWNER",
    "PROJECT,ADMIN",
    "PROJECT,GLOBAL_ADMIN",
    "PROJECT,SUPER_ADMIN",
    "TEAM,OWNER",
    "TEAM,ADMIN",
    "TEAM,GLOBAL_ADMIN",
    "TEAM,SUPER_ADMIN"
  })
  void authorizedViewersCanOpenArchivedDetailsAndHistory(String level, String viewer)
      throws Exception {
    String auth = viewer(viewer);
    archive(level);
    for (String path :
        new String[] {
          workspace.taskPath(),
          workspace.taskPath() + "/activities",
          projectPath(),
          projectPath() + "/activities",
          teamPath(),
          teamPath() + "/activities"
        }) {
      mvc.perform(get(path).header("Authorization", auth)).andExpect(status().isOk());
    }
    assertListCount(tasksPath() + "?deletedFilter=ALL", 1, auth);
    mvc.perform(get(workspace.taskPath()).header("Authorization", auth))
        .andExpect(jsonPath("$.readOnly").value(true));
  }

  @ParameterizedTest
  @CsvSource({
    "TASK,MEMBER",
    "TASK,FORMER_MEMBER",
    "TASK,OUTSIDER",
    "PROJECT,MEMBER",
    "PROJECT,FORMER_MEMBER",
    "PROJECT,OUTSIDER",
    "TEAM,MEMBER",
    "TEAM,FORMER_MEMBER",
    "TEAM,OUTSIDER"
  })
  void archivedTaskReadsRemainHiddenFromUnauthorizedViewers(String level, String viewer)
      throws Exception {
    String auth = viewer(viewer);
    archive(level);
    mvc.perform(get(workspace.taskPath()).header("Authorization", auth))
        .andExpect(status().isNotFound());
    mvc.perform(get(workspace.taskPath() + "/activities").header("Authorization", auth))
        .andExpect(status().isNotFound());
    if (level.equals("TASK") && viewer.equals("MEMBER")) {
      assertListCount(tasksPath() + "?deletedFilter=ALL", 0, auth);
    } else {
      mvc.perform(get(tasksPath() + "?deletedFilter=ALL").header("Authorization", auth))
          .andExpect(status().isNotFound());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"TASK", "PROJECT", "TEAM"})
  void archivedItemsRejectEveryTaskMutationAndRepeatedArchive(String level) throws Exception {
    archive(level);
    for (String[] operation :
        new String[][] {
          {"", "{\"name\":\"Forbidden edit\"}"},
          {"/status", "{\"status\":\"IN_PROGRESS\"}"},
          {"/assignee/" + workspace.owner().getId(), "{}"},
          {"/support/" + workspace.owner().getId(), "{}"}
        }) {
      mvc.perform(
              patch(workspace.taskPath() + operation[0])
                  .header("Authorization", ownerAuthorization)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(operation[1]))
          .andExpect(status().isNotFound());
    }
    mvc.perform(
            post(workspace.taskPath() + "/activities")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"Forbidden comment\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(delete(workspace.taskPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isNotFound());
    transactions.executeWithoutResult(
        status -> {
          assertThat(em.find(TaskEntity.class, workspace.task().getId()).getName())
              .isEqualTo("Original task");
          assertThat(
                  em.createQuery(
                          "select count(e) from ActivityEventEntity e where e.taskId = :task",
                          Long.class)
                      .setParameter("task", workspace.task().getId())
                      .getSingleResult())
              .isEqualTo(1);
        });
    if (!level.equals("TASK")) {
      mvc.perform(
              patch(projectPath())
                  .header("Authorization", ownerAuthorization)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"name\":\"Forbidden\"}"))
          .andExpect(status().isNotFound());
      mvc.perform(
              patch(projectPath() + "/status")
                  .header("Authorization", ownerAuthorization)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"status\":\"ON_HOLD\"}"))
          .andExpect(status().isNotFound());
      mvc.perform(
              post(tasksPath())
                  .header("Authorization", ownerAuthorization)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      "{\"name\":\"Forbidden\",\"priority\":\"MEDIUM\",\"assigneeId\":\""
                          + workspace.owner().getId()
                          + "\",\"plannedStartDate\":\"2026-01-01T00:00:00Z\",\"plannedDueDate\":\"2026-01-02T00:00:00Z\"}"))
          .andExpect(status().isNotFound());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"PROJECT", "TEAM"})
  void archivedAncestorAloneControlsTaskVisibilityAndReadOnly(String level) throws Exception {
    transactions.executeWithoutResult(
        status -> {
          if (level.equals("TEAM"))
            em.find(TeamEntity.class, workspace.team().getId()).setDeletedAt(WORKFLOW_TIME);
          else
            em.find(ProjectEntity.class, workspace.project().getId()).setDeletedAt(WORKFLOW_TIME);
        });
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.readOnly").value(true))
        .andExpect(jsonPath("$.deletedAt").isEmpty());
    assertListCount(tasksPath() + "?deletedFilter=DELETED", 1);
    assertListCount(tasksPath() + "?deletedFilter=ACTIVE", 0);
    if (level.equals("TEAM")) {
      assertListCount(teamPath() + "/projects?deletedFilter=DELETED", 1);
      assertListCount(teamPath() + "/projects?deletedFilter=ACTIVE", 0);
      mvc.perform(get(projectPath()).header("Authorization", ownerAuthorization))
          .andExpect(jsonPath("$.readOnly").value(true));
    }
    String memberAuth = viewer("MEMBER");
    mvc.perform(get(workspace.taskPath()).header("Authorization", memberAuth))
        .andExpect(status().isNotFound());
    mvc.perform(get(workspace.taskPath() + "/activities").header("Authorization", memberAuth))
        .andExpect(status().isNotFound());
  }

  @Test
  void activeTaskRemainsWritableAndLegacyArchiveStillReadable() throws Exception {
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.readOnly").value(false));
    mvc.perform(
            patch(workspace.taskPath() + "/status")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}"))
        .andExpect(status().isOk());
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          task.setStatus(TaskStatus.DELETED);
          task.setDeletedAt(WORKFLOW_TIME);
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          project.setStatus(ProjectStatus.DELETED);
          project.setDeletedAt(WORKFLOW_TIME);
        });
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DELETED"))
        .andExpect(jsonPath("$.readOnly").value(true));
    assertListCount(tasksPath() + "?deletedFilter=DELETED&status=DELETED", 1);
    mvc.perform(get(projectPath()).header("Authorization", ownerAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DELETED"));
  }

  @Test
  void teamCascadeKeepsAnEarlierProjectArchiveAndItsActor() throws Exception {
    String adminAuth = viewer("ADMIN");
    mvc.perform(delete(projectPath()).header("Authorization", adminAuth))
        .andExpect(status().isNoContent());
    String[] earlier =
        transactions.execute(
            status -> {
              var project = em.find(ProjectEntity.class, workspace.project().getId());
              return new String[] {
                project.getDeletedAt().toString(), project.getDeletedBy().getId().toString()
              };
            });
    archive("TEAM");
    transactions.executeWithoutResult(
        status -> {
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          var task = em.find(TaskEntity.class, workspace.task().getId());
          assertThat(project.getDeletedAt().toString()).isEqualTo(earlier[0]);
          assertThat(project.getDeletedBy().getId().toString()).isEqualTo(earlier[1]);
          assertThat(task.getDeletedBy().getId().toString()).isEqualTo(earlier[1]);
          assertThat(
                  em.createQuery(
                          "select count(e) from ActivityEventEntity e where e.projectId = :project and e.eventType = :type",
                          Long.class)
                      .setParameter("project", project.getId())
                      .setParameter("type", ActivityEventType.PROJECT_DELETED)
                      .getSingleResult())
              .isEqualTo(1);
        });
  }

  @ParameterizedTest
  @CsvSource({
    "TASK,ADMIN,true",
    "PROJECT,ADMIN,true",
    "TEAM,ADMIN,false",
    "TASK,MEMBER,false",
    "PROJECT,MEMBER,false",
    "TASK,GLOBAL_ADMIN,false",
    "PROJECT,SUPER_ADMIN,false"
  })
  void archiveRightsStillFollowTeamRoles(String level, String role, boolean allowed)
      throws Exception {
    mvc.perform(
            delete(
                    level.equals("TEAM")
                        ? teamPath()
                        : level.equals("PROJECT") ? projectPath() : workspace.taskPath())
                .header("Authorization", viewer(role)))
        .andExpect(allowed ? status().isNoContent() : status().isForbidden());
  }

  @Test
  void archivedTaskCannotBeReadThroughAnotherTeamOrProject() throws Exception {
    var other = transactions.execute(status -> TestFixtures.workspace(em));
    archive("TASK");
    for (String path :
        new String[] {
          "/api/teams/"
              + other.team().getKey()
              + "/projects/"
              + workspace.project().getKey()
              + "/tasks/1",
          teamPath() + "/projects/" + other.project().getKey() + "/tasks/1"
        }) {
      mvc.perform(get(path).header("Authorization", ownerAuthorization))
          .andExpect(status().isNotFound());
      mvc.perform(get(path + "/activities").header("Authorization", ownerAuthorization))
          .andExpect(status().isNotFound());
    }
  }

  private void setWorkflow(TaskStatus taskStatus, ProjectStatus projectStatus) {
    transactions.executeWithoutResult(
        status -> {
          var owner = em.find(UserEntity.class, workspace.owner().getId());
          var task = em.find(TaskEntity.class, workspace.task().getId());
          task.setStatus(taskStatus);
          task.setStatusChangedAt(WORKFLOW_TIME);
          task.setActualStartDate(WORKFLOW_TIME);
          if (taskStatus == TaskStatus.DONE) {
            task.setActualCompletionDate(WORKFLOW_TIME.plusSeconds(60));
            task.setCompletedBy(owner);
          }
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          project.setStatus(projectStatus);
          project.setStatusChangedAt(WORKFLOW_TIME);
          project.setActualStartDate(WORKFLOW_TIME);
          project.setActualCompletionDate(WORKFLOW_TIME.plusSeconds(60));
          project.setCompletedBy(owner);
        });
  }

  private void assertTaskWorkflow(TaskStatus expected) {
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          assertThat(task.getStatus()).isEqualTo(expected);
          assertThat(task.getStatusChangedAt()).isEqualTo(WORKFLOW_TIME);
          assertThat(task.getActualStartDate()).isEqualTo(WORKFLOW_TIME);
          if (expected == TaskStatus.DONE) {
            assertThat(task.getActualCompletionDate()).isEqualTo(WORKFLOW_TIME.plusSeconds(60));
            assertThat(task.getCompletedBy().getId()).isEqualTo(workspace.owner().getId());
          } else {
            assertThat(task.getActualCompletionDate()).isNull();
            assertThat(task.getCompletedBy()).isNull();
          }
        });
  }

  private String viewer(String role) {
    if (role.equals("OWNER")) return ownerAuthorization;
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Archive");
          user.setLastName(role);
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("unused");
          user.setRole(
              role.equals("GLOBAL_ADMIN")
                  ? UserRole.ADMIN
                  : role.equals("SUPER_ADMIN") ? UserRole.SUPER_ADMIN : UserRole.USER);
          em.persist(user);
          if (role.equals("ADMIN") || role.equals("MEMBER")) {
            var member = new TeamMemberEntity();
            member.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
            member.setUser(user);
            member.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            member.setRole(TeamRole.valueOf(role));
            em.persist(member);
          }
          if (role.equals("FORMER_MEMBER"))
            em.find(TaskEntity.class, workspace.task().getId()).setAssignee(user);
          return authorization(user);
        });
  }

  private String authorization(UserEntity user) {
    return "Bearer " + jwt.generateToken(user);
  }

  private String teamPath() {
    return "/api/teams/" + workspace.team().getKey();
  }

  private String projectPath() {
    return teamPath() + "/projects/" + workspace.project().getKey();
  }

  private String tasksPath() {
    return projectPath() + "/tasks";
  }

  private void archive(String level) throws Exception {
    mvc.perform(
            delete(
                    level.equals("TEAM")
                        ? teamPath()
                        : level.equals("PROJECT") ? projectPath() : workspace.taskPath())
                .header("Authorization", ownerAuthorization))
        .andExpect(status().isNoContent());
  }

  private void assertListCount(String path, int count) throws Exception {
    assertListCount(path, count, ownerAuthorization);
  }

  private void assertListCount(String path, int count, String auth) throws Exception {
    mvc.perform(get(path).header("Authorization", auth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(count));
  }
}
