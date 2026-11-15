package com.example.task_manager.observability;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class ObservabilityAccessIntegrationTest extends PostgresIntegrationTest {
  @Autowired EntityManager em;
  @Autowired TransactionTemplate transactions;
  @Autowired WebApplicationContext context;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;

  private MockMvc mvc;
  private Workspace workspace;
  private String ownerAuth;
  private String team;
  private String project;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    ownerAuth = authorization(workspace.owner());
    team = "/api/teams/" + workspace.team().getKey();
    project = team + "/projects/" + workspace.project().getKey();
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void authorizesManagersInScopeAndKeepsOrdinaryActivityReadable() throws Exception {
    assertInsightsAccess(ownerAuth, status().isOk());
    assertInsightsAccess(authorization(user(UserRole.USER, TeamRole.ADMIN)), status().isOk());
    for (UserRole role : List.of(UserRole.ADMIN, UserRole.SUPER_ADMIN)) {
      assertInsightsAccess(authorization(user(role, null)), status().isOk());
    }

    String memberAuth = authorization(user(UserRole.USER, TeamRole.MEMBER));
    assertInsightsAccess(memberAuth, status().isForbidden());
    assertActivityAccess(memberAuth);

    var otherTeam = transactions.execute(status -> TestFixtures.workspace(em));
    assertInsightsAccess(authorization(otherTeam.owner()), status().isForbidden());
  }

  @Test
  void honorsRoleDemotionWithoutRequiringASessionChange() throws Exception {
    var manager = user(UserRole.USER, TeamRole.ADMIN);
    String managerAuth = authorization(manager);
    assertInsightsAccess(managerAuth, status().isOk());

    mvc.perform(
            patch(team + "/members/" + manager.getId() + "/role")
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"MEMBER\"}"))
        .andExpect(status().isOk());

    assertInsightsAccess(managerAuth, status().isForbidden());
    assertActivityAccess(managerAuth);
  }

  @Test
  void keepsArchivedInsightsForManagersAndHidesArchivedResourcesFromMembers() throws Exception {
    String managerAuth = authorization(user(UserRole.USER, TeamRole.ADMIN));
    String memberAuth = authorization(user(UserRole.USER, TeamRole.MEMBER));
    String globalAuth = authorization(user(UserRole.ADMIN, null));
    mvc.perform(delete(project).header("Authorization", ownerAuth))
        .andExpect(status().isNoContent());
    for (String suffix : List.of("/summary", "/audit-logs", "/system-events")) {
      mvc.perform(get(project + "/insights" + suffix).header("Authorization", memberAuth))
          .andExpect(status().isNotFound());
    }

    mvc.perform(delete(team).header("Authorization", ownerAuth)).andExpect(status().isNoContent());
    for (String auth : List.of(ownerAuth, managerAuth, globalAuth)) {
      assertInsightsAccess(auth, status().isOk());
    }
    assertInsightsAccess(memberAuth, status().isNotFound());
  }

  private void assertInsightsAccess(String bearer, ResultMatcher expected) throws Exception {
    for (String scope : List.of(team, project)) {
      for (String suffix : List.of("/summary", "/audit-logs", "/system-events")) {
        mvc.perform(get(scope + "/insights" + suffix).header("Authorization", bearer))
            .andExpect(expected);
      }
    }
    mvc.perform(get(team + "/insights/overdue-tasks").header("Authorization", bearer))
        .andExpect(expected);
  }

  private void assertActivityAccess(String bearer) throws Exception {
    for (String scope : List.of(team, project, workspace.taskPath())) {
      mvc.perform(get(scope + "/activities").header("Authorization", bearer))
          .andExpect(status().isOk());
    }
  }

  private String authorization(UserEntity user) {
    return TestFixtures.authorization(jwt, sessions, user);
  }

  private UserEntity user(UserRole globalRole, TeamRole teamRole) {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Insights");
          user.setLastName("Viewer");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("unused");
          user.setRole(globalRole);
          em.persist(user);
          if (teamRole != null) {
            var membership = new TeamMemberEntity();
            membership.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
            membership.setUser(user);
            membership.setRole(teamRole);
            membership.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            em.persist(membership);
          }
          return user;
        });
  }
}
