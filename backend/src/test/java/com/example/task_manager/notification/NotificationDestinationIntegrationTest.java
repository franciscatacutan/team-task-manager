package com.example.task_manager.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.notification.entity.NotificationEntity;
import com.example.task_manager.notification.entity.NotificationType;
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
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

class NotificationDestinationIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  @Autowired NotificationRepository notifications;
  private MockMvc mvc;
  private Workspace workspace;
  private final JsonMapper json = JsonMapper.builder().build();

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @CsvSource({
    "USER,MEMBER,none,TASK,true",
    "USER,MEMBER,task,TASK,false",
    "USER,ADMIN,task,TASK,true",
    "USER,OWNER,task,TASK,true",
    "USER,MEMBER,project,TASK,false",
    "USER,ADMIN,project,TASK,true",
    "USER,MEMBER,team,TASK,false",
    "USER,ADMIN,team,TASK,true",
    "ADMIN,NONE,team,TASK,true",
    "SUPER_ADMIN,NONE,team,TASK,true",
    "USER,NONE,none,TASK,false",
    "USER,MEMBER,none,PROJECT,true",
    "USER,MEMBER,project,PROJECT,false",
    "USER,ADMIN,project,PROJECT,true",
    "ADMIN,NONE,project,PROJECT,true",
    "USER,MEMBER,none,TEAM,true",
    "USER,MEMBER,team,TEAM,false",
    "USER,ADMIN,team,TEAM,true",
    "ADMIN,NONE,team,TEAM,true",
    "USER,NONE,none,TEAM,false"
  })
  void destinationAgreesWithActualDetailReadPolicy(
      String globalRole, String teamRole, String archive, NotificationType type, boolean available)
      throws Exception {
    UserEntity viewer = viewer(globalRole, teamRole);
    String bearer = TestFixtures.authorization(jwt, sessions, viewer);
    UUID id = notification(viewer, type);
    transactions.executeWithoutResult(
        status -> {
          if (archive.equals("task"))
            em.find(TaskEntity.class, workspace.task().getId()).setDeletedAt(Instant.now());
          if (archive.equals("project"))
            em.find(ProjectEntity.class, workspace.project().getId()).setDeletedAt(Instant.now());
          if (archive.equals("team"))
            em.find(TeamEntity.class, workspace.team().getId()).setDeletedAt(Instant.now());
        });
    var result =
        mvc.perform(
                get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(available))
            .andReturn();
    String path = detail(type);
    if (available) {
      assertThat(
              json.readTree(result.getResponse().getContentAsString()).get("targetPath").asText())
          .isEqualTo(path.replace("/api", ""));
      mvc.perform(get(path).header("Authorization", bearer)).andExpect(status().isOk());
    } else {
      mvc.perform(get(path).header("Authorization", bearer)).andExpect(status().isNotFound());
      assertThat(
              json.readTree(result.getResponse().getContentAsString()).get("targetPath").isNull())
          .isTrue();
    }
    assertThat(notifications.findById(id).orElseThrow().getReadAt()).isNull();
  }

  @Test
  void checksCurrentMembershipAfterAnInboxWasLoadedAndRetainsTheReadNotification()
      throws Exception {
    var viewer = viewer("USER", "MEMBER");
    String bearer = TestFixtures.authorization(jwt, sessions, viewer);
    UUID id = notification(viewer, NotificationType.TASK);
    mvc.perform(get("/api/notifications").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1));
    transactions.executeWithoutResult(
        status ->
            em.createQuery(
                    "delete from TeamMemberEntity m where m.team.id=:team and m.user.id=:user")
                .setParameter("team", workspace.team().getId())
                .setParameter("user", viewer.getId())
                .executeUpdate());
    mvc.perform(patch("/api/notifications/" + id + "/read").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.read").value(true));
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false));
    mvc.perform(get("/api/notifications").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].read").value(true));
  }

  @Test
  void foreignAndUnknownNotificationsAreNotFound() throws Exception {
    UUID id = notification(workspace.owner(), NotificationType.TASK);
    var outsider = viewer("USER", "NONE");
    String bearer = TestFixtures.authorization(jwt, sessions, outsider);
    for (UUID target : new UUID[] {id, UUID.randomUUID()})
      mvc.perform(
              get("/api/notifications/" + target + "/destination").header("Authorization", bearer))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.message").value("Notification not found"));
  }

  @Test
  void missingTargetsAndLegacyArbitraryPathsAreUnavailableRatherThanParentFallbacks()
      throws Exception {
    UUID id = notification(workspace.owner(), NotificationType.TASK);
    String bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    transactions.executeWithoutResult(
        status -> em.find(NotificationEntity.class, id).setTaskId(UUID.randomUUID()));
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false));
    transactions.executeWithoutResult(
        status -> {
          var n = em.find(NotificationEntity.class, id);
          n.setTaskId(null);
          n.setProjectId(null);
          n.setTeamId(null);
          n.setTargetPath("https://example.test/arbitrary");
        });
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false));
  }

  @Test
  void resolvesCurrentPublicKeysInsteadOfStoredLegacyRoutes() throws Exception {
    UUID id = notification(workspace.owner(), NotificationType.TASK);
    String bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    String newKey = "RENAMED-" + UUID.randomUUID();
    transactions.executeWithoutResult(
        status -> em.find(ProjectEntity.class, workspace.project().getId()).setKey(newKey));
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.targetPath")
                .value("/teams/" + workspace.team().getKey() + "/projects/" + newKey + "/tasks/1"));
  }

  @Test
  void legacyEventMetadataResolvesMembershipRoutesWithoutTrustingStoredPaths() throws Exception {
    UUID id = notification(workspace.owner(), NotificationType.TEAM);
    String bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    transactions.executeWithoutResult(
        status -> {
          var event = new ActivityEventEntity();
          event.setTeamId(workspace.team().getId());
          event.setEntityType(ActivityEntityType.TEAM);
          event.setEntityId(workspace.team().getId());
          event.setEventType(ActivityEventType.TEAM_MEMBER_ADDED);
          event.setDetails(
              new ActivityEventDetails(
                  List.of(), null, null, null, List.of(), null, null, null, null));
          event.setMessage("Membership event");
          event.setUser(em.find(UserEntity.class, workspace.owner().getId()));
          em.persist(event);
          var item = em.find(NotificationEntity.class, id);
          item.setActivityEvent(event);
          item.setTeamId(null);
        });
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$.targetPath").value("/teams/" + workspace.team().getKey() + "/members"));
  }

  @Test
  void mismatchedParentMetadataDoesNotRedirectToAnUnrelatedTask() throws Exception {
    UUID id = notification(workspace.owner(), NotificationType.TASK);
    String bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    transactions.executeWithoutResult(
        status -> em.find(NotificationEntity.class, id).setProjectId(UUID.randomUUID()));
    mvc.perform(get("/api/notifications/" + id + "/destination").header("Authorization", bearer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.available").value(false));
  }

  private UserEntity viewer(String global, String role) {
    if (role.equals("OWNER")) return workspace.owner();
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Test");
          user.setLastName("Viewer");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("not-used");
          user.setRole(UserRole.valueOf(global));
          em.persist(user);
          if (!role.equals("NONE")) {
            var m = new TeamMemberEntity();
            m.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
            m.setUser(user);
            m.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            m.setRole(TeamRole.valueOf(role));
            em.persist(m);
          }
          em.flush();
          return user;
        });
  }

  private UUID notification(UserEntity recipient, NotificationType type) {
    return transactions.execute(
        status -> {
          var n = new NotificationEntity();
          n.setRecipient(em.find(UserEntity.class, recipient.getId()));
          n.setType(type);
          n.setTitle("Retained notification");
          n.setBody("Historical contents");
          n.setTargetPath("/teams/" + workspace.team().getId());
          n.setTeamId(workspace.team().getId());
          if (type != NotificationType.TEAM) n.setProjectId(workspace.project().getId());
          if (type == NotificationType.TASK) n.setTaskId(workspace.task().getId());
          em.persist(n);
          em.flush();
          return n.getId();
        });
  }

  private String detail(NotificationType type) {
    return switch (type) {
      case TEAM -> "/api/teams/" + workspace.team().getKey();
      case PROJECT ->
          "/api/teams/" + workspace.team().getKey() + "/projects/" + workspace.project().getKey();
      case TASK -> workspace.taskPath();
    };
  }
}
