package com.example.task_manager.team;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class TeamPermissionIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService authSessions;
  private MockMvc mvc;
  private Workspace workspace;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @EnumSource(UserRole.class)
  void teamCreationDependsOnGlobalRole(UserRole globalRole) throws Exception {
    var user = user(globalRole, null);
    var result =
        mvc.perform(
            post("/api/teams")
                .header("Authorization", authorization(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"New team\"}"));
    if (globalRole == UserRole.USER) result.andExpect(status().isForbidden());
    else
      result
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.owner.userId").value(user.getId().toString()));
  }

  @Test
  void ordinaryOwnerCanUpdateAndArchiveTheirTeam() throws Exception {
    String authorization = authorization(workspace.owner());
    mvc.perform(
            patch(teamPath())
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Renamed by owner\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Renamed by owner"));
    mvc.perform(delete(teamPath()).header("Authorization", authorization))
        .andExpect(status().isNoContent());
    assertThat(
            transactions.<java.time.Instant>execute(
                status -> em.find(TeamEntity.class, workspace.team().getId()).getDeletedAt()))
        .isNotNull();
  }

  @ParameterizedTest
  @CsvSource({"USER,ADMIN", "USER,MEMBER", "ADMIN,NONE"})
  void nonOwnersCannotChangeTeamDetailsOrArchive(UserRole globalRole, String role)
      throws Exception {
    var requester = user(globalRole, role.equals("NONE") ? null : TeamRole.valueOf(role));
    String authorization = authorization(requester);
    mvc.perform(
            patch(teamPath())
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Forbidden rename\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(delete(teamPath()).header("Authorization", authorization))
        .andExpect(status().isForbidden());
    assertThat(
            transactions.<java.time.Instant>execute(
                status -> em.find(TeamEntity.class, workspace.team().getId()).getDeletedAt()))
        .isNull();
  }

  @ParameterizedTest
  @EnumSource(
      value = UserRole.class,
      names = {"ADMIN", "SUPER_ADMIN"})
  void globalAdminsCanReadWithoutTeamMembership(UserRole globalRole) throws Exception {
    String authorization = authorization(user(globalRole, null));
    for (String path :
        new String[] {teamPath(), teamPath() + "/members", projectPath(), workspace.taskPath()}) {
      mvc.perform(get(path).header("Authorization", authorization)).andExpect(status().isOk());
    }
    mvc.perform(get(teamPath() + "/me").header("Authorization", authorization))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").isEmpty());
  }

  @Test
  void teamAdminCanReadWithinTheirTeamButNotAnotherTeam() throws Exception {
    String authorization = authorization(user(UserRole.USER, TeamRole.ADMIN));
    var other = transactions.execute(status -> TestFixtures.workspace(em));
    mvc.perform(get(projectPath()).header("Authorization", authorization))
        .andExpect(status().isOk());
    mvc.perform(get(workspace.taskPath()).header("Authorization", authorization))
        .andExpect(status().isOk());
    mvc.perform(get("/api/teams/" + other.team().getKey()).header("Authorization", authorization))
        .andExpect(status().isNotFound());
    mvc.perform(get(other.taskPath()).header("Authorization", authorization))
        .andExpect(status().isNotFound());
  }

  @ParameterizedTest
  @CsvSource({"USER,ADMIN,true", "USER,MEMBER,false", "ADMIN,NONE,false", "SUPER_ADMIN,NONE,false"})
  void projectAndTaskEditsRequireTeamManagement(UserRole globalRole, String role, boolean allowed)
      throws Exception {
    String authorization =
        authorization(user(globalRole, role.equals("NONE") ? null : TeamRole.valueOf(role)));
    var project =
        mvc.perform(
            patch(projectPath() + "/status")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"ON_HOLD\"}"));
    var task =
        mvc.perform(
            patch(workspace.taskPath())
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Updated task\"}"));
    if (allowed) {
      project.andExpect(status().isOk());
      task.andExpect(status().isOk());
    } else {
      project.andExpect(status().isForbidden());
      task.andExpect(status().isForbidden());
    }
  }

  @Test
  void teamAdminCanAddAndRemoveRegularMembers() throws Exception {
    String authorization = authorization(user(UserRole.USER, TeamRole.ADMIN));
    var candidate = user(UserRole.USER, null);
    mvc.perform(
            post(teamPath() + "/members")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"members\":[{\"userId\":\""
                        + candidate.getId()
                        + "\",\"role\":\"MEMBER\"}]}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success[0].id").value(candidate.getId().toString()));
    mvc.perform(
            delete(teamPath() + "/members")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + candidate.getId() + "\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success[0]").value(candidate.getId().toString()));
  }

  @Test
  void teamAdminCannotGrantOrRevokeAdminRoles() throws Exception {
    String authorization = authorization(user(UserRole.USER, TeamRole.ADMIN));
    var regular = user(UserRole.USER, TeamRole.MEMBER);
    var admin = user(UserRole.USER, TeamRole.ADMIN);
    mvc.perform(
            patch(teamPath() + "/members/" + regular.getId() + "/role")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            patch(teamPath() + "/members/" + admin.getId() + "/role")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"MEMBER\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void teamAdminCannotBypassAdminGrantRuleWhenAddingMembers() throws Exception {
    String authorization = authorization(user(UserRole.USER, TeamRole.ADMIN));
    var candidate = user(UserRole.USER, null);
    mvc.perform(
            post(teamPath() + "/members")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"members\":[{\"userId\":\""
                        + candidate.getId()
                        + "\",\"role\":\"ADMIN\"}]}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").isEmpty())
        .andExpect(jsonPath("$.failed[0].userId").value(candidate.getId().toString()));
    assertThat(
            transactions.<Long>execute(
                status ->
                    em.createQuery(
                            "SELECT COUNT(m) FROM TeamMemberEntity m WHERE m.team.id = :teamId AND m.user.id = :userId",
                            Long.class)
                        .setParameter("teamId", workspace.team().getId())
                        .setParameter("userId", candidate.getId())
                        .getSingleResult()))
        .isZero();
  }

  @Test
  void ownerCanTransferToAnOrdinaryCurrentMember() throws Exception {
    var successor = user(UserRole.USER, TeamRole.MEMBER);
    mvc.perform(
            patch(teamPath() + "/transfer/" + successor.getId())
                .header("Authorization", authorization(workspace.owner())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamRole").value("OWNER"));
    assertOwnership(successor, workspace.owner());
  }

  @ParameterizedTest
  @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
  void superAdminCanRecoverOwnershipWithoutBeingTheCurrentOwner(boolean hasMembership)
      throws Exception {
    var requester = user(UserRole.SUPER_ADMIN, hasMembership ? TeamRole.MEMBER : null);
    var successor = user(UserRole.USER, TeamRole.MEMBER);
    mvc.perform(
            patch(teamPath() + "/transfer/" + successor.getId())
                .header("Authorization", authorization(requester)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.teamRole").value("OWNER"));
    assertOwnership(successor, requester);
    var role =
        transactions.execute(status -> em.find(UserEntity.class, successor.getId()).getRole());
    assertThat(role).isEqualTo(UserRole.USER);
    long membershipCount =
        transactions.execute(
            status ->
                em.createQuery(
                        "SELECT COUNT(m) FROM TeamMemberEntity m WHERE m.team.id = :team AND m.user.id = :user",
                        Long.class)
                    .setParameter("team", workspace.team().getId())
                    .setParameter("user", requester.getId())
                    .getSingleResult());
    assertThat(membershipCount).isEqualTo(hasMembership ? 1 : 0);
  }

  @Test
  void nonmemberSuperAdminCanGrantAndRevokeAdminRolesButCannotOtherwiseAdministerTeam()
      throws Exception {
    var requester = user(UserRole.SUPER_ADMIN, null);
    var member = user(UserRole.USER, TeamRole.MEMBER);
    String authorization = authorization(requester);
    for (String role : new String[] {"ADMIN", "MEMBER"}) {
      mvc.perform(
              patch(teamPath() + "/members/" + member.getId() + "/role")
                  .header("Authorization", authorization)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"role\":\"" + role + "\"}"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.teamRole").value(role));
    }
    mvc.perform(
            patch(teamPath())
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Forbidden rename\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(delete(teamPath()).header("Authorization", authorization))
        .andExpect(status().isForbidden());
    mvc.perform(
            post(teamPath() + "/members")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"members\":[{\"userId\":\"" + member.getId() + "\",\"role\":\"MEMBER\"}]}"))
        .andExpect(status().isForbidden());
    mvc.perform(
            delete(teamPath() + "/members")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + member.getId() + "\"]}"))
        .andExpect(status().isForbidden());
  }

  @ParameterizedTest
  @CsvSource({"ADMIN,NONE", "ADMIN,ADMIN", "USER,ADMIN", "USER,MEMBER"})
  void onlyOwnersAndSuperAdminsCanRecoverOwnershipOrManageAdminRoles(
      UserRole globalRole, String role) throws Exception {
    var requester = user(globalRole, role.equals("NONE") ? null : TeamRole.valueOf(role));
    var successor = user(UserRole.USER, TeamRole.MEMBER);
    String authorization = authorization(requester);
    mvc.perform(
            patch(teamPath() + "/transfer/" + successor.getId())
                .header("Authorization", authorization))
        .andExpect(status().isForbidden());
    mvc.perform(
            patch(teamPath() + "/members/" + successor.getId() + "/role")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\"}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void ownershipRecoveryRequiresACurrentMemberAndPreservesOwnerInvariants() throws Exception {
    var requester = user(UserRole.SUPER_ADMIN, null);
    var outsider = user(UserRole.USER, null);
    String authorization = authorization(requester);
    mvc.perform(
            patch(teamPath() + "/transfer/" + outsider.getId())
                .header("Authorization", authorization))
        .andExpect(status().isForbidden());
    mvc.perform(
            patch(teamPath() + "/transfer/" + workspace.owner().getId())
                .header("Authorization", authorization))
        .andExpect(status().isConflict());
    mvc.perform(
            patch(teamPath() + "/members/" + workspace.owner().getId() + "/role")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"MEMBER\"}"))
        .andExpect(status().isConflict());
    assertThat(
            transactions.<UUID>execute(
                status -> em.find(TeamEntity.class, workspace.team().getId()).getOwner().getId()))
        .isEqualTo(workspace.owner().getId());
  }

  @Test
  void recoveryDoesNotPermitSelfRoleChangesOrArchivedTeamWrites() throws Exception {
    var requester = user(UserRole.SUPER_ADMIN, TeamRole.MEMBER);
    String authorization = authorization(requester);
    mvc.perform(
            patch(teamPath() + "/members/" + requester.getId() + "/role")
                .header("Authorization", authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"ADMIN\"}"))
        .andExpect(status().isConflict());
    transactions.executeWithoutResult(
        status ->
            em.find(TeamEntity.class, workspace.team().getId())
                .setDeletedAt(java.time.Instant.now()));
    mvc.perform(
            patch(teamPath() + "/transfer/" + requester.getId())
                .header("Authorization", authorization))
        .andExpect(status().isNotFound());
  }

  private void assertOwnership(UserEntity successor, UserEntity actor) {
    transactions.executeWithoutResult(
        status -> {
          var team = em.find(TeamEntity.class, workspace.team().getId());
          assertThat(team.getOwner().getId()).isEqualTo(successor.getId());
          assertThat(team.getOwnerChangedAt()).isNotNull();
          var members =
              em.createQuery(
                      "SELECT m FROM TeamMemberEntity m WHERE m.team.id = :team",
                      TeamMemberEntity.class)
                  .setParameter("team", team.getId())
                  .getResultList();
          assertThat(
                  members.stream()
                      .filter(m -> m.getRole() == TeamRole.OWNER)
                      .map(m -> m.getUser().getId())
                      .toList())
              .containsExactly(successor.getId());
          assertThat(
                  members.stream()
                      .filter(m -> m.getUser().getId().equals(workspace.owner().getId()))
                      .findFirst()
                      .orElseThrow()
                      .getRole())
              .isEqualTo(TeamRole.ADMIN);
          var event =
              em.createQuery(
                      "SELECT e FROM ActivityEventEntity e WHERE e.teamId = :team AND e.eventType = :type",
                      com.example.task_manager.activity.entity.ActivityEventEntity.class)
                  .setParameter("team", team.getId())
                  .setParameter(
                      "type",
                      com.example.task_manager.activity.dto.ActivityEventType
                          .TEAM_OWNERSHIP_TRANSFERRED)
                  .getSingleResult();
          assertThat(event.getUser().getId()).isEqualTo(actor.getId());
          assertThat(event.getDetails().from()).isEqualTo(workspace.owner().getFullName());
          assertThat(event.getDetails().to()).isEqualTo(successor.getFullName());
          long auditCount =
              em.createQuery(
                      "SELECT COUNT(a) FROM AuditLogEntity a WHERE a.teamId = :team AND a.actor.id = :actor AND a.eventType = :type",
                      Long.class)
                  .setParameter("team", team.getId())
                  .setParameter("actor", actor.getId())
                  .setParameter(
                      "type",
                      com.example.task_manager.activity.dto.ActivityEventType
                          .TEAM_OWNERSHIP_TRANSFERRED)
                  .getSingleResult();
          assertThat(auditCount).isEqualTo(1);
        });
  }

  private UserEntity user(UserRole globalRole, TeamRole teamRole) {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Test");
          user.setLastName("Requester");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("not-used-for-bearer-tests");
          user.setRole(globalRole);
          em.persist(user);
          if (teamRole != null) {
            var membership = new TeamMemberEntity();
            membership.setUser(user);
            membership.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
            membership.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            membership.setRole(teamRole);
            em.persist(membership);
          }
          em.flush();
          return user;
        });
  }

  private String authorization(UserEntity user) {
    return TestFixtures.authorization(jwt, authSessions, user);
  }

  private String teamPath() {
    return "/api/teams/" + workspace.team().getKey();
  }

  private String projectPath() {
    return workspace.taskPath().replace("/tasks/1", "");
  }
}
