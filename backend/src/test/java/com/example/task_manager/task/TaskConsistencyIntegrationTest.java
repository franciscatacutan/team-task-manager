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
import com.example.task_manager.task.entity.TaskStatus;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
  @Autowired TaskPlanningCalendar planningCalendar;
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
  @ValueSource(strings = {"#1", "1", "  #1  ", "Original task"})
  void findsTasksByProjectNumberOrText(String search) throws Exception {
    mvc.perform(get(tasksPath()).header("Authorization", ownerAuth).param("search", search))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].taskNumber").value(1));
  }

  @ParameterizedTest
  @ValueSource(strings = {"%", "_", "!", "\\"})
  void findsOnlyTasksContainingTheLiteralSearchCharacter(String character) throws Exception {
    String name = "Literal " + character + " example";
    jdbc.update("update tasks set name = ? where id = ?", name, workspace.task().getId());
    create("Unrelated task", TaskPriority.MEDIUM).andExpect(status().isCreated());

    mvc.perform(get(tasksPath()).header("Authorization", ownerAuth).param("search", character))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].name").value(name));
  }

  @Test
  void concurrentCreationsInTheSameProjectKeepAllTasksAndDistinctNumbers() throws Exception {
    var admin = user(UserRole.USER, TeamRole.ADMIN);
    var assignee = user(UserRole.USER, TeamRole.MEMBER);
    String adminAuth = TestFixtures.authorization(jwt, sessions, admin);
    int count = 6;
    var ready = new CountDownLatch(count);
    var start = new CountDownLatch(1);
    List<Future<Integer>> creations = new ArrayList<>();
    try (var executor = Executors.newFixedThreadPool(count)) {
      try {
        for (int index = 0; index < count; index++) {
          String name = "Parallel task " + index;
          String auth = index % 2 == 0 ? ownerAuth : adminAuth;
          creations.add(
              executor.submit(
                  () -> {
                    ready.countDown();
                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                    String response =
                        create(name, TaskPriority.MEDIUM, auth, assignee.getId())
                            .andExpect(status().isCreated())
                            .andExpect(jsonPath("$.name").value(name))
                            .andReturn()
                            .getResponse()
                            .getContentAsString();
                    return JsonPath.read(response, "$.taskNumber");
                  }));
        }
        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      } finally {
        start.countDown();
      }
      List<Integer> taskNumbers = new ArrayList<>();
      for (Future<Integer> creation : creations) {
        taskNumbers.add(creation.get(20, TimeUnit.SECONDS));
      }
      assertThat(taskNumbers).containsExactlyInAnyOrder(2, 3, 4, 5, 6, 7);
    }

    mvc.perform(get(tasksPath()).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(count + 1));
    assertThat(
            jdbc.queryForObject(
                """
                select count(*) from activity_events
                where project_id = ? and event_type = 'TASK_CREATED'
                """,
                Long.class,
                workspace.project().getId()))
        .isEqualTo(count);
    mvc.perform(
            get("/api/notifications")
                .header("Authorization", TestFixtures.authorization(jwt, sessions, assignee)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(count));

    create("After concurrent writes", TaskPriority.MEDIUM)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.taskNumber").value(8));
  }

  @Test
  void dueTodayIsOnTimeInTaskFiltersAndBothInsightsViews() throws Exception {
    var today = planningCalendar.day(Instant.now());
    var yesterday = today.minusDays(1).toString();
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          task.setPlannedStartDate(planningCalendar.parse(yesterday));
          task.setPlannedDueDate(planningCalendar.parse(yesterday));
        });
    mvc.perform(
            post(tasksPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
              {"name":"Due today","priority":"MEDIUM","assigneeId":"%s",
               "plannedStartDate":"%s","plannedDueDate":"%s"}
              """
                        .formatted(workspace.owner().getId(), today, today)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.plannedDueDay").value(today.toString()));
    mvc.perform(get(tasksPath()).header("Authorization", ownerAuth).param("overdue", "true"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].taskNumber").value(1));

    String team = "/api/teams/" + workspace.team().getKey();
    for (String path : List.of(team, team + "/projects/" + workspace.project().getKey())) {
      mvc.perform(get(path + "/insights/summary").header("Authorization", ownerAuth))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.tasks.overdue").value(1));
    }
  }

  @Test
  void projectCompletionRequiresTheCurrentOpenTaskCountAndLeavesTasksEditable() throws Exception {
    String project = tasksPath().replace("/tasks", "");
    String statusPath = project + "/status";
    completeProject(statusPath, null)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.type").value("urn:ttm:project-completion-confirmation-required"))
        .andExpect(jsonPath("$.openTaskCount").value(1));
    mvc.perform(get(project).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ACTIVE"))
        .andExpect(jsonPath("$.actualCompletionDate").isEmpty());
    create("Added before confirmation", TaskPriority.HIGH).andExpect(status().isCreated());
    completeProject(statusPath, 1)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.openTaskCount").value(2));
    completeProject(statusPath, 2)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"))
        .andExpect(jsonPath("$.actualCompletionDate").isNotEmpty());
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("TODO"));
    create("Added after completion", TaskPriority.LOW).andExpect(status().isCreated());
    mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Edited after completion\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Edited after completion"));
  }

  @Test
  void completedAndArchivedTasksDoNotRequireConfirmation() throws Exception {
    transactions.executeWithoutResult(
        status -> em.find(TaskEntity.class, workspace.task().getId()).setStatus(TaskStatus.DONE));
    create("To be archived", TaskPriority.HIGH).andExpect(status().isCreated());
    mvc.perform(delete(tasksPath() + "/2").header("Authorization", ownerAuth))
        .andExpect(status().isNoContent());
    completeProject(tasksPath().replace("/tasks", "/status"), null)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
  }

  @Test
  void teamOverdueListMatchesTheSummaryAcrossProjectsAndPages() throws Exception {
    var today = planningCalendar.day(Instant.now());
    var yesterday = planningCalendar.parse(today.minusDays(1).toString());
    var oldest = planningCalendar.parse(today.minusDays(2).toString());
    var manager = user(UserRole.USER, TeamRole.ADMIN);
    var admin = user(UserRole.ADMIN, null);
    String managerAuth = TestFixtures.authorization(jwt, sessions, manager);
    String adminAuth = TestFixtures.authorization(jwt, sessions, admin);
    String secondProjectKey =
        transactions.execute(
            status -> {
              var project = em.find(ProjectEntity.class, workspace.project().getId());
              var second = siblingProject(project, "Second project");
              var archived = siblingProject(project, "Archived project");
              archived.setDeletedAt(Instant.now());
              em.find(TaskEntity.class, workspace.task().getId()).setPlannedDueDate(oldest);
              for (int i = 1; i <= 20; i++) {
                overdueFixture(second, i, yesterday);
              }
              overdueFixture(archived, 1, oldest);
              overdueFixture(project, 2, oldest).setDeletedAt(Instant.now());
              overdueFixture(project, 3, oldest).setStatus(TaskStatus.DONE);
              overdueFixture(project, 4, oldest).setStatus(TaskStatus.CANCELLED);
              overdueFixture(project, 5, planningCalendar.parse(today.toString()));
              overdueFixture(project, 6, null);
              var other = TestFixtures.workspace(em);
              other.task().setPlannedDueDate(oldest);
              return second.getKey();
            });

    String insights = "/api/teams/" + workspace.team().getKey() + "/insights";
    String path = insights + "/overdue-tasks";
    mvc.perform(get(insights + "/summary").header("Authorization", managerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.health.overdueTasks").value(21))
        .andExpect(jsonPath("$.tasks.overdue").value(21));
    String first =
        mvc.perform(get(path).header("Authorization", managerAuth).param("size", "100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(21))
            .andExpect(jsonPath("$.totalPages").value(2))
            .andExpect(jsonPath("$.content.length()").value(20))
            .andExpect(jsonPath("$.content[0].projectKey").value(workspace.project().getKey()))
            .andExpect(jsonPath("$.content[0].taskNumber").value(1))
            .andExpect(jsonPath("$.content[0].plannedDueDay").value(today.minusDays(2).toString()))
            .andExpect(jsonPath("$.content[1].projectName").value("Second project"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String second =
        mvc.perform(get(path).header("Authorization", managerAuth).param("page", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(21))
            .andExpect(jsonPath("$.last").value(true))
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.content[0].projectKey").value(secondProjectKey))
            .andReturn()
            .getResponse()
            .getContentAsString();
    List<Integer> firstProjectNumbers = JsonPath.read(first, "$.content[1:].taskNumber");
    Integer lastNumber = JsonPath.read(second, "$.content[0].taskNumber");
    assertThat(firstProjectNumbers).doesNotContain(lastNumber);
    mvc.perform(get(path).header("Authorization", adminAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(21));
    mvc.perform(get(path).header("Authorization", managerAuth).param("page", "2147483647"))
        .andExpect(status().isBadRequest());

    jdbc.update(
        "delete from team_members where team_id = ? and user_id = ?",
        workspace.team().getId(),
        manager.getId());
    mvc.perform(get(path).header("Authorization", managerAuth)).andExpect(status().isForbidden());
    transactions.executeWithoutResult(
        status -> em.find(TeamEntity.class, workspace.team().getId()).setDeletedAt(Instant.now()));
    mvc.perform(get(path).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  void newTeamOwnerCanFindAndReassignOpenWorkAfterRemovingTheFormerOwner() throws Exception {
    var departing = workspace.owner();
    var successor = user(UserRole.USER, TeamRole.MEMBER);
    String successorAuth = TestFixtures.authorization(jwt, sessions, successor);
    String teamPath = "/api/teams/" + workspace.team().getKey();
    String members = teamPath + "/members";
    String removal = "{\"userIds\":[\"" + departing.getId() + "\"]}";
    String supportedTask = tasksPath() + "/2";
    create("Review deployment", TaskPriority.HIGH).andExpect(status().isCreated());
    mvc.perform(
            patch(supportedTask + "/assignee/" + successor.getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isOk());
    mvc.perform(
            patch(supportedTask + "/support/" + departing.getId())
                .header("Authorization", ownerAuth))
        .andExpect(status().isOk());

    mvc.perform(
            delete(members)
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(removal))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.failed[0].code").value("CONFLICT"));
    mvc.perform(
            patch(teamPath + "/transfer/" + successor.getId()).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamRole").value("OWNER"));
    mvc.perform(
            delete(members)
                .header("Authorization", successorAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content(removal))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success[0]").value(departing.getId().toString()));
    mvc.perform(get(workspace.taskPath()).header("Authorization", ownerAuth))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/my-work").header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));

    mvc.perform(
            get(tasksPath())
                .header("Authorization", successorAuth)
                .param("assigneeId", departing.getId().toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].taskNumber").value(1));
    mvc.perform(
            get(tasksPath())
                .header("Authorization", successorAuth)
                .param("search", departing.getLastName())
                .param("sort", "taskNumber,asc"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content[1].supportUser.id").value(departing.getId().toString()));
    mvc.perform(
            patch(workspace.taskPath() + "/assignee/" + successor.getId())
                .header("Authorization", successorAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.assignedUser.id").value(successor.getId().toString()));
    mvc.perform(delete(supportedTask + "/support").header("Authorization", successorAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.supportUser").isEmpty());
    mvc.perform(
            get(tasksPath())
                .header("Authorization", successorAuth)
                .param("search", departing.getLastName()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  void assigneeChoicesUseVisibleTaskAssignmentsEvenAfterMembershipRemoval() throws Exception {
    var formerMember = user(UserRole.USER, TeamRole.MEMBER);
    String formerAuth = TestFixtures.authorization(jwt, sessions, formerMember);
    var currentMember = user(UserRole.USER, TeamRole.MEMBER);
    String memberAuth = TestFixtures.authorization(jwt, sessions, currentMember);
    var other = transactions.execute(status -> TestFixtures.workspace(em));
    create("Second task", TaskPriority.HIGH).andExpect(status().isCreated());
    create("Owner task", TaskPriority.HIGH).andExpect(status().isCreated());

    transactions.executeWithoutResult(
        status -> {
          var assigned = em.find(UserEntity.class, formerMember.getId());
          em.find(TaskEntity.class, workspace.task().getId()).setAssignee(assigned);
          em.find(TaskEntity.class, other.task().getId()).setAssignee(assigned);
        });
    jdbc.update(
        "delete from team_members where team_id = ? and user_id = ?",
        workspace.team().getId(),
        formerMember.getId());

    jdbc.update(
        "update tasks set assignee_id = ? where project_id = ? and task_number = 2",
        formerMember.getId(),
        workspace.project().getId());
    mvc.perform(
            get(tasksPath())
                .header("Authorization", memberAuth)
                .param("assigneeId", formerMember.getId().toString())
                .param("priority", "MEDIUM", "HIGH")
                .param("sort", "taskNumber,asc")
                .param("size", "1")
                .param("page", "1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content[0].taskNumber").value(2));

    String path = tasksPath() + "/assignees";
    mvc.perform(get(path).header("Authorization", ownerAuth).param("size", "200"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.size").value(20))
        .andExpect(jsonPath("$.totalElements").value(2));
    mvc.perform(
            get(path).header("Authorization", memberAuth).param("search", formerMember.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].id").value(formerMember.getId().toString()));
    mvc.perform(get(path).header("Authorization", formerAuth)).andExpect(status().isNotFound());

    mvc.perform(delete(workspace.taskPath()).header("Authorization", ownerAuth))
        .andExpect(status().isNoContent());
    mvc.perform(delete(tasksPath() + "/2").header("Authorization", ownerAuth))
        .andExpect(status().isNoContent());
    mvc.perform(
            get(path)
                .header("Authorization", ownerAuth)
                .param("deletedFilter", "ALL")
                .param("assigneeId", formerMember.getId().toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(
            get(path)
                .header("Authorization", memberAuth)
                .param("deletedFilter", "ALL")
                .param("assigneeId", formerMember.getId().toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
    mvc.perform(
            get(other.taskPath().replace("/tasks/1", "/tasks/assignees"))
                .header("Authorization", ownerAuth))
        .andExpect(status().isNotFound());
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

  private ProjectEntity siblingProject(ProjectEntity project, String name) {
    var sibling = new ProjectEntity();
    sibling.setKey("PROJECT-" + UUID.randomUUID());
    sibling.setName(name);
    sibling.setTeam(project.getTeam());
    sibling.setOwner(project.getOwner());
    em.persist(sibling);
    return sibling;
  }

  private TaskEntity overdueFixture(ProjectEntity project, long number, Instant dueDate) {
    var task = new TaskEntity();
    task.setName("Task " + number);
    task.setProject(project);
    task.setTaskNumber(number);
    task.setAssignee(project.getOwner());
    task.setPriority(TaskPriority.HIGH);
    task.setPlannedDueDate(dueDate);
    em.persist(task);
    return task;
  }

  private ResultActions completeProject(String statusPath, Integer openTaskCount) throws Exception {
    String confirmation =
        openTaskCount == null ? "" : ",\"confirmedOpenTaskCount\":" + openTaskCount;
    return mvc.perform(
        patch(statusPath)
            .header("Authorization", ownerAuth)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"COMPLETED\"" + confirmation + "}"));
  }

  private ResultActions create(String name, TaskPriority priority) throws Exception {
    return create(name, priority, ownerAuth, workspace.owner().getId());
  }

  private ResultActions create(
      String name, TaskPriority priority, String authorization, UUID assigneeId) throws Exception {
    return mvc.perform(
        post(tasksPath())
            .header("Authorization", authorization)
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"name\":\""
                    + name
                    + "\",\"priority\":\""
                    + priority.name()
                    + "\",\"assigneeId\":\""
                    + assigneeId
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
