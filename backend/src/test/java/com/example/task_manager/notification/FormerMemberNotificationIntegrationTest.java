package com.example.task_manager.notification;

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
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class FormerMemberNotificationIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService authSessions;
  private MockMvc mvc;
  private Workspace workspace;
  private UserEntity member;
  private UserEntity activeMember;
  private String ownerAuthorization;
  private String memberAuthorization;
  private String activeAuthorization;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    member = transactions.execute(status -> addMember());
    activeMember = transactions.execute(status -> addMember());
    ownerAuthorization = TestFixtures.authorization(jwt, authSessions, workspace.owner());
    memberAuthorization = TestFixtures.authorization(jwt, authSessions, member);
    activeAuthorization = TestFixtures.authorization(jwt, authSessions, activeMember);
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void removedAssigneeOrSupportKeepsHistoryButGetsNoFutureTaskOrProjectUpdates(boolean support)
      throws Exception {
    transactions.executeWithoutResult(
        status -> {
          var task = em.find(TaskEntity.class, workspace.task().getId());
          var participant = em.find(UserEntity.class, member.getId());
          var remaining = em.find(UserEntity.class, activeMember.getId());
          task.setAssignee(support ? remaining : participant);
          task.setSupport(support ? participant : remaining);
          em.find(ProjectEntity.class, workspace.project().getId()).setOwner(participant);
        });
    postComment("BEFORE_REMOVAL_COMMENT");
    renameProject("BEFORE_REMOVAL_PROJECT");

    mvc.perform(
            delete("/api/teams/" + workspace.team().getKey() + "/members")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + member.getId() + "\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success[0]").value(member.getId().toString()));
    postComment("AFTER_REMOVAL_PRIVATE_COMMENT");
    renameProject("AFTER_REMOVAL_PRIVATE_PROJECT");

    String formerInbox =
        mvc.perform(get("/api/notifications").header("Authorization", memberAuthorization))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(3))
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(formerInbox)
        .contains("BEFORE_REMOVAL_COMMENT", "BEFORE_REMOVAL_PROJECT", "TEAM_MEMBER_REMOVED")
        .doesNotContain("AFTER_REMOVAL_PRIVATE_COMMENT", "AFTER_REMOVAL_PRIVATE_PROJECT");
    String activeInbox =
        mvc.perform(get("/api/notifications").header("Authorization", activeAuthorization))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(activeInbox).contains("AFTER_REMOVAL_PRIVATE_COMMENT");

    mvc.perform(get("/api/notifications/unread-count").header("Authorization", memberAuthorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.unreadCount").value(3));
  }

  @Test
  void removedProjectCreatorGetsNoFutureProjectUpdates() throws Exception {
    transactions.executeWithoutResult(
        status ->
            em.find(ProjectEntity.class, workspace.project().getId())
                .setCreatedBy(em.find(UserEntity.class, member.getId())));
    mvc.perform(
            delete("/api/teams/" + workspace.team().getKey() + "/members")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + member.getId() + "\"]}"))
        .andExpect(status().isOk());
    renameProject("PRIVATE_PROJECT_AFTER_CREATOR_REMOVAL");
    String inbox =
        mvc.perform(get("/api/notifications").header("Authorization", memberAuthorization))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(inbox)
        .contains("TEAM_MEMBER_REMOVED")
        .doesNotContain("PRIVATE_PROJECT_AFTER_CREATOR_REMOVAL");
  }

  @Test
  void currentMembersStillReceiveCascadeArchiveNotifications() throws Exception {
    transactions.executeWithoutResult(
        status -> {
          em.find(UserEntity.class, workspace.owner().getId()).setRole(UserRole.ADMIN);
          em.find(TaskEntity.class, workspace.task().getId())
              .setAssignee(em.find(UserEntity.class, member.getId()));
        });
    mvc.perform(
            delete("/api/teams/" + workspace.team().getKey())
                .header("Authorization", ownerAuthorization))
        .andExpect(status().isNoContent());
    String inbox =
        mvc.perform(get("/api/notifications").header("Authorization", memberAuthorization))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    assertThat(inbox).contains("TEAM_DELETED", "TASK_DELETED");
  }

  private void postComment(String message) throws Exception {
    mvc.perform(
            post(workspace.taskPath() + "/activities")
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"" + message + "\"}"))
        .andExpect(status().isOk());
  }

  private void renameProject(String name) throws Exception {
    String path = workspace.taskPath().replace("/tasks/1", "");
    mvc.perform(
            patch(path)
                .header("Authorization", ownerAuthorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\"}"))
        .andExpect(status().isOk());
  }

  private UserEntity addMember() {
    var user = new UserEntity();
    user.setFirstName("Test");
    user.setLastName("Member");
    user.setEmail(UUID.randomUUID() + "@example.test");
    user.setPassword("not-used-for-bearer-token-tests");
    user.setRole(UserRole.USER);
    em.persist(user);
    var membership = new TeamMemberEntity();
    membership.setUser(user);
    membership.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
    membership.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
    membership.setRole(TeamRole.MEMBER);
    em.persist(membership);
    em.flush();
    return user;
  }
}
