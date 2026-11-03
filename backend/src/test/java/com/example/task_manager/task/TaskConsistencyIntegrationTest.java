package com.example.task_manager.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
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
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class TaskConsistencyIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private MockMvc mvc;
  private Workspace workspace;
  private String ownerAuth;

  @BeforeEach
  void setUp() {
    workspace =
        transactions.execute(
            status -> {
              var result = TestFixtures.workspace(em);
              result.project().setNextTaskNumber(2L);
              return result;
            });
    ownerAuth = TestFixtures.authorization(jwt, sessions, workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @EnumSource(TaskPriority.class)
  void everyPriorityCanBeCreatedFilteredAndUpdated(TaskPriority priority) throws Exception {
    create("Priority task", priority)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.priority").value(priority.name()));
    mvc.perform(
            get(tasksPath())
                .header("Authorization", ownerAuth)
                .param("priority", priority.name())
                .param("search", "Priority task"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].priority").value(priority.name()));
    mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"priority\":\"" + priority.name() + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.priority").value(priority.name()));
  }

  @ParameterizedTest
  @ValueSource(strings = {" x ", "  ab  ", "  A normal name  "})
  void creationAndUpdateShareTheApprovedTrimmedNameRule(String name) throws Exception {
    create(name, TaskPriority.CRITICAL)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value(name.trim()));
    mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value(name.trim()));
  }

  @Test
  void lengthLimitAppliesAfterTrimmingForCreateAndUpdate() throws Exception {
    String name = "x".repeat(100);
    create("  " + name + "  ", TaskPriority.LOW)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value(name));
    mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"  " + name + "  \"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value(name));
  }

  @ParameterizedTest
  @ValueSource(strings = {"blank", "long"})
  void blankAndOverlongNamesAreRejectedWithoutChanges(String kind) throws Exception {
    String name = kind.equals("blank") ? "   " : "x".repeat(101);
    create(name, TaskPriority.LOW).andExpect(status().isBadRequest());
    mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuth))
        .andExpect(jsonPath("$.name").value("Original task"));
  }

  @ParameterizedTest
  @CsvSource({
    "USER,OWNER,true",
    "USER,ADMIN,true",
    "USER,MEMBER,false",
    "ADMIN,NONE,false",
    "SUPER_ADMIN,NONE,false"
  })
  void supportRemovalUsesExistingTeamManagementPermissions(
      UserRole globalRole, String role, boolean allowed) throws Exception {
    var support = user(UserRole.USER, TeamRole.MEMBER);
    setSupport(support);
    String auth =
        role.equals("OWNER")
            ? ownerAuth
            : TestFixtures.authorization(
                jwt,
                sessions,
                user(globalRole, role.equals("NONE") ? null : TeamRole.valueOf(role)));
    var result =
        mvc.perform(delete(workspace.taskPath() + "/support").header("Authorization", auth));
    if (allowed) {
      result.andExpect(status().isOk()).andExpect(jsonPath("$.supportUser").isEmpty());
      assertThat(supportId()).isNull();
      mvc.perform(get(workspace.taskPath() + "/activities").header("Authorization", ownerAuth))
          .andExpect(jsonPath("$.content[0].type").value("TASK_SUPPORT_REMOVED"))
          .andExpect(
              jsonPath("$.content[0].details.subjectUser.id").value(support.getId().toString()));
    } else {
      result.andExpect(status().isForbidden());
      assertThat(supportId()).isEqualTo(support.getId());
      assertThat(activityCount()).isZero();
    }
  }

  @Test
  void clearingSupportIsIdempotentAndDoesNotArchiveTheTask() throws Exception {
    setSupport(user(UserRole.USER, TeamRole.MEMBER));
    for (int i = 0; i < 2; i++)
      mvc.perform(delete(workspace.taskPath() + "/support").header("Authorization", ownerAuth))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.supportUser").isEmpty())
          .andExpect(jsonPath("$.readOnly").value(false));
    assertThat(activityCount()).isEqualTo(1);
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.deletedAt").isEmpty());
  }

  @Test
  void clearingAnAlreadyEmptySupportIsANoop() throws Exception {
    mvc.perform(delete(workspace.taskPath() + "/support").header("Authorization", ownerAuth))
        .andExpect(status().isOk());
    assertThat(activityCount()).isZero();
  }

  @ParameterizedTest
  @ValueSource(strings = {"TASK", "PROJECT", "TEAM"})
  void archivedScopesRejectSupportRemoval(String level) throws Exception {
    var support = user(UserRole.USER, TeamRole.MEMBER);
    setSupport(support);
    transactions.executeWithoutResult(
        status -> {
          if (level.equals("TASK"))
            em.find(TaskEntity.class, workspace.task().getId()).setDeletedAt(Instant.now());
          if (level.equals("PROJECT"))
            em.find(ProjectEntity.class, workspace.project().getId()).setDeletedAt(Instant.now());
          if (level.equals("TEAM"))
            em.find(TeamEntity.class, workspace.team().getId()).setDeletedAt(Instant.now());
        });
    mvc.perform(delete(workspace.taskPath() + "/support").header("Authorization", ownerAuth))
        .andExpect(status().isNotFound());
    assertThat(supportId()).isEqualTo(support.getId());
    assertThat(activityCount()).isZero();
  }

  @Test
  void assignmentRoutesKeepCompatibilityAndRejectConflictingOrNonmemberSupport() throws Exception {
    var support = user(UserRole.USER, TeamRole.MEMBER);
    mvc.perform(
            patch(workspace.taskPath() + "/support/" + support.getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.supportUser.id").value(support.getId().toString()));
    mvc.perform(
            patch(workspace.taskPath() + "/support/" + workspace.owner().getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isConflict());
    var outsider = user(UserRole.USER, null);
    mvc.perform(
            patch(workspace.taskPath() + "/support/" + outsider.getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isForbidden());
    assertThat(supportId()).isEqualTo(support.getId());
    assertThat(activityCount()).isEqualTo(1);
    mvc.perform(
            patch(workspace.taskPath() + "/assignee/" + support.getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assignedUser.id").value(support.getId().toString()))
        .andExpect(jsonPath("$.supportUser").isEmpty());
  }

  @Test
  void clearingAFormerSupportDoesNotSendThemAConfidentialNotification() throws Exception {
    var former = user(UserRole.USER, TeamRole.MEMBER);
    setSupport(former);
    jdbc.update(
        "delete from team_members where team_id = ? and user_id = ?",
        workspace.team().getId(),
        former.getId());
    mvc.perform(delete(workspace.taskPath() + "/support").header("Authorization", ownerAuth))
        .andExpect(status().isOk());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from notifications where recipient_id = ?",
                Long.class,
                former.getId()))
        .isZero();
  }

  @Test
  void eligibleMembersCanBePagedAndSearchedBeyondTheFirstPage() throws Exception {
    List<UserEntity> members = new ArrayList<>();
    for (int i = 0; i < 25; i++) members.add(user(UserRole.USER, TeamRole.MEMBER));
    String path = "/api/teams/" + workspace.team().getKey() + "/members";
    String first =
        mvc.perform(
                get(path)
                    .header("Authorization", ownerAuth)
                    .param("size", "20")
                    .param("sort", "user.lastName,asc", "user.email,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(20))
            .andExpect(jsonPath("$.last").value(false))
            .andReturn()
            .getResponse()
            .getContentAsString();
    List<String> firstIds = JsonPath.read(first, "$.content[*].id");
    UserEntity beyond =
        members.stream()
            .filter(user -> !firstIds.contains(user.getId().toString()))
            .findFirst()
            .orElseThrow();
    String second =
        mvc.perform(
                get(path)
                    .header("Authorization", ownerAuth)
                    .param("size", "20")
                    .param("page", "1")
                    .param("sort", "user.lastName,asc", "user.email,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(6))
            .andExpect(jsonPath("$.last").value(true))
            .andReturn()
            .getResponse()
            .getContentAsString();
    List<String> secondIds = JsonPath.read(second, "$.content[*].id");
    assertThat(secondIds).doesNotContainAnyElementsOf(firstIds);
    mvc.perform(get(path).header("Authorization", ownerAuth).param("search", beyond.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].id").value(beyond.getId().toString()));
    jdbc.update(
        "delete from team_members where team_id = ? and user_id = ?",
        workspace.team().getId(),
        beyond.getId());
    mvc.perform(get(path).header("Authorization", ownerAuth).param("search", beyond.getEmail()))
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @ParameterizedTest
  @ValueSource(strings = {"asc", "desc"})
  void prioritySortingUsesSeverityInPagedProjectAndPersonalQueries(String direction)
      throws Exception {
    for (var priority : TaskPriority.values()) {
      create("Severity " + priority.name(), priority).andExpect(status().isCreated());
    }
    List<String> expected = new ArrayList<>(List.of("LOW", "MEDIUM", "HIGH", "CRITICAL"));
    if ("desc".equals(direction)) java.util.Collections.reverse(expected);
    List<String> actual = new ArrayList<>();
    for (int page = 0; page < 2; page++) {
      String json =
          mvc.perform(
                  get(tasksPath())
                      .header("Authorization", ownerAuth)
                      .param("search", "Severity")
                      .param("sort", "priority," + direction)
                      .param("size", "2")
                      .param("page", Integer.toString(page)))
              .andExpect(status().isOk())
              .andExpect(jsonPath("$.totalElements").value(4))
              .andReturn()
              .getResponse()
              .getContentAsString();
      actual.addAll(JsonPath.<List<String>>read(json, "$.content[*].priority"));
    }
    assertThat(actual).containsExactlyElementsOf(expected);
    String unpaged =
        mvc.perform(
                get(tasksPath())
                    .header("Authorization", ownerAuth)
                    .param("search", "Severity")
                    .param("sort", "priority," + direction)
                    .param("all", "true"))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(JsonPath.<List<String>>read(unpaged, "$.content[*].priority"))
        .containsExactlyElementsOf(expected);

    String personal =
        mvc.perform(
                get(tasksPath() + "/my-task")
                    .header("Authorization", ownerAuth)
                    .param("sort", "priority," + direction)
                    .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(5))
            .andReturn()
            .getResponse()
            .getContentAsString();
    List<String> personalExpected =
        new ArrayList<>(List.of("LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"));
    if ("desc".equals(direction)) java.util.Collections.reverse(personalExpected);
    assertThat(JsonPath.<List<String>>read(personal, "$.content[*].priority"))
        .containsExactlyElementsOf(personalExpected);
  }

  @Test
  void internalPriorityRankIsNotAnAcceptedPublicSortField() throws Exception {
    mvc.perform(
            get(tasksPath()).header("Authorization", ownerAuth).param("sort", "priorityRank,asc"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get(tasksPath())
                .header("Authorization", ownerAuth)
                .param("sort", "priorityRank,asc")
                .param("all", "true"))
        .andExpect(status().isBadRequest());
  }

  private ResultActions create(String name, TaskPriority priority) throws Exception {
    return mvc.perform(
        post(tasksPath())
            .header("Authorization", ownerAuth)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"name\":\""
                    + name
                    + "\",\"priority\":\""
                    + priority.name()
                    + "\",\"assigneeId\":\""
                    + workspace.owner().getId()
                    + "\",\"plannedStartDate\":\"2026-01-01T00:00:00Z\",\"plannedDueDate\":\"2026-01-02T00:00:00Z\"}"));
  }

  private String tasksPath() {
    return workspace.taskPath().replace("/tasks/1", "/tasks");
  }

  private UserEntity user(UserRole global, TeamRole role) {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Selectable");
          user.setLastName("Member");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("unused");
          user.setRole(global);
          em.persist(user);
          if (role != null) {
            var member = new TeamMemberEntity();
            member.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
            member.setUser(user);
            member.setRole(role);
            member.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            em.persist(member);
          }
          return user;
        });
  }

  private void setSupport(UserEntity user) {
    transactions.executeWithoutResult(
        status ->
            em.find(TaskEntity.class, workspace.task().getId())
                .setSupport(em.find(UserEntity.class, user.getId())));
  }

  private UUID supportId() {
    return transactions.execute(
        status -> {
          var user = em.find(TaskEntity.class, workspace.task().getId()).getSupport();
          return user == null ? null : user.getId();
        });
  }

  private long activityCount() {
    return jdbc.queryForObject(
        "select count(*) from activity_events where task_id = ?",
        Long.class,
        workspace.task().getId());
  }
}
