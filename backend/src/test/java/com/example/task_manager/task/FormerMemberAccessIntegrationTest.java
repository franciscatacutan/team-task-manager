package com.example.task_manager.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
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
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class FormerMemberAccessIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService authSessions;
  private MockMvc mvc;
  private Workspace workspace;
  private UserEntity member;
  private String ownerAuthorization;
  private String memberAuthorization;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    member = transactions.execute(status -> addMember(workspace));
    ownerAuthorization = TestFixtures.authorization(jwt, authSessions, workspace.owner());
    memberAuthorization = TestFixtures.authorization(jwt, authSessions, member);
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @ValueSource(strings = {"my-task", "project-task"})
  void personalFeedsRespectProjectScopeAndIncludeAssigneeOrSupport(String route) throws Exception {
    transactions.executeWithoutResult(
        status -> {
          var project = em.find(ProjectEntity.class, workspace.project().getId());
          var assignee = em.find(UserEntity.class, member.getId());
          var owner = em.find(UserEntity.class, workspace.owner().getId());
          em.find(TaskEntity.class, workspace.task().getId()).setAssignee(assignee);
          var supported = task(project, owner, 2, "Supported task");
          supported.setSupport(assignee);
          em.persist(supported);
          var archived = task(project, assignee, 3, "Archived task");
          archived.setDeletedAt(Instant.now());
          em.persist(archived);
          var otherWorkspace = TestFixtures.workspace(em);
          var otherMembership = new TeamMemberEntity();
          otherMembership.setTeam(otherWorkspace.team());
          otherMembership.setUser(assignee);
          otherMembership.setAddedBy(otherWorkspace.owner());
          otherMembership.setRole(TeamRole.MEMBER);
          em.persist(otherMembership);
          otherWorkspace.task().setAssignee(assignee);
          otherWorkspace.task().setName("Other project task");
        });

    mvc.perform(get(feedPath(route)).header("Authorization", memberAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(
            jsonPath("$.content[*].name", containsInAnyOrder("Original task", "Supported task")));
  }

  @ParameterizedTest
  @CsvSource({"my-task,false", "project-task,false", "my-task,true", "project-task,true"})
  void removedAssigneesAndSupportCannotReadPersonalFeeds(String route, boolean support)
      throws Exception {
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          if (support) task.setSupport(em.find(UserEntity.class, member.getId()));
          else task.setAssignee(em.find(UserEntity.class, member.getId()));
        });
    mvc.perform(get(feedPath(route)).header("Authorization", memberAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
    mvc.perform(
            delete("/api/teams/" + workspace.team().getKey() + "/members")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + member.getId() + "\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success[0]").value(member.getId().toString()));

    mvc.perform(get(feedPath(route)).header("Authorization", memberAuthorization))
        .andExpect(status().isNotFound());
    mvc.perform(get(workspace.taskPath()).header("Authorization", memberAuthorization))
        .andExpect(status().isNotFound());
    UUID retainedAssignment =
        transactions.execute(
            status -> {
              var task = em.find(TaskEntity.class, workspace.task().getId());
              return support ? task.getSupport().getId() : task.getAssignee().getId();
            });
    assertThat(retainedAssignment).isEqualTo(member.getId());
  }

  @ParameterizedTest
  @ValueSource(strings = {"my-task", "project-task"})
  void personalFeedsRejectMissingOrMismatchedParents(String route) throws Exception {
    var foreign = transactions.execute(status -> TestFixtures.workspace(em));
    String[] paths = {
      "/api/teams/MISSING/projects/MISSING/tasks/" + route,
      "/api/teams/"
          + workspace.team().getKey()
          + "/projects/"
          + foreign.project().getKey()
          + "/tasks/"
          + route,
      "/api/teams/"
          + foreign.team().getKey()
          + "/projects/"
          + workspace.project().getKey()
          + "/tasks/"
          + route,
      "/api/teams/"
          + foreign.team().getKey()
          + "/projects/"
          + foreign.project().getKey()
          + "/tasks/"
          + route
    };
    for (String path : paths) {
      mvc.perform(get(path).header("Authorization", memberAuthorization))
          .andExpect(status().isNotFound());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"my-task", "project-task"})
  void personalFeedsRequireAuthentication(String route) throws Exception {
    mvc.perform(get(feedPath(route))).andExpect(status().isUnauthorized());
  }

  @ParameterizedTest
  @CsvSource({"my-task,false", "project-task,false", "my-task,true", "project-task,true"})
  void personalFeedsRejectArchivedParents(String route, boolean team) throws Exception {
    transactions.executeWithoutResult(
        status -> {
          em.find(TaskEntity.class, workspace.task().getId())
              .setAssignee(em.find(UserEntity.class, member.getId()));
          if (team) em.find(TeamEntity.class, workspace.team().getId()).setDeletedAt(Instant.now());
          else
            em.find(ProjectEntity.class, workspace.project().getId()).setDeletedAt(Instant.now());
        });
    mvc.perform(get(feedPath(route)).header("Authorization", memberAuthorization))
        .andExpect(status().isNotFound());
  }

  private UserEntity addMember(Workspace workspace) {
    var user = new UserEntity();
    user.setFirstName("Test");
    user.setLastName("Member");
    user.setEmail(UUID.randomUUID() + "@example.test");
    user.setPassword("not-used-for-bearer-token-tests");
    user.setRole(UserRole.USER);
    em.persist(user);
    var membership = new TeamMemberEntity();
    membership.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
    membership.setUser(user);
    membership.setRole(TeamRole.MEMBER);
    membership.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
    em.persist(membership);
    em.flush();
    return user;
  }

  private TaskEntity task(ProjectEntity project, UserEntity assignee, long number, String name) {
    var task = new TaskEntity();
    task.setProject(project);
    task.setAssignee(assignee);
    task.setTaskNumber(number);
    task.setName(name);
    task.setPriority(TaskPriority.MEDIUM);
    task.setPlannedStartDate(Instant.now());
    task.setPlannedDueDate(Instant.now().plusSeconds(86400));
    return task;
  }

  private String feedPath(String route) {
    return workspace.taskPath().replace("/tasks/1", "/tasks/" + route);
  }
}
