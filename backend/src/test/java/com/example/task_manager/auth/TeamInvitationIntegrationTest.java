package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserRole;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class TeamInvitationIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private MockMvc mvc;
  private Workspace workspace;
  private String owner;
  private String team;
  private String email;

  @DynamicPropertySource
  static void requireInvitation(DynamicPropertyRegistry properties) {
    properties.add("auth.open-registration", () -> false);
  }

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    owner = TestFixtures.authorization(jwt, sessions, workspace.owner());
    team = "/api/teams/" + workspace.team().getKey();
    email = UUID.randomUUID() + "@example.test";
  }

  @Test
  void inviteIsEmailBoundAndCreatesAMemberAndSessionOnlyOnce() throws Exception {
    mvc.perform(get("/api/auth/registration"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.openRegistration").value(false));
    signup(email, null).andExpect(status().isForbidden());

    String token = invite(email.toUpperCase(java.util.Locale.ROOT));
    assertThat(
            jdbc.queryForObject(
                "select token_hash from team_invitations where team_id = ? and email = ?",
                String.class,
                workspace.team().getId(),
                email))
        .hasSize(64)
        .isNotEqualTo(token);
    signup("wrong@example.test", token).andExpect(status().isBadRequest());
    var created =
        signup(email, token)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.role").value("USER"))
            .andExpect(header().exists("Set-Cookie"))
            .andReturn()
            .getResponse()
            .getContentAsString();
    String access = JsonPath.read(created, "$.token");
    mvc.perform(get(team + "/me").header("Authorization", "Bearer " + access))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("MEMBER"));
    signup(email, token).andExpect(status().isBadRequest());
  }

  @Test
  void managersCanReplaceLinksAndExpiredLinksCannotCreateAnAccount() throws Exception {
    String first = invite(email);
    String replacement = invite(email);
    assertThat(first).isNotEqualTo(replacement);
    signup(email, first).andExpect(status().isBadRequest());
    jdbc.update(
        "update team_invitations set expires_at = CURRENT_TIMESTAMP - interval '1 minute' where team_id = ? and email = ?",
        workspace.team().getId(),
        email);
    signup(email, replacement).andExpect(status().isBadRequest());
    assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Long.class, email))
        .isZero();
  }

  @Test
  void existingAccountsAndPeopleWithoutManagerMembershipCannotReceiveOrIssueInvites()
      throws Exception {
    mvc.perform(
            post(team + "/invitations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\"}"))
        .andExpect(status().isUnauthorized());
    var outsider = transactions.execute(status -> TestFixtures.workspace(em));
    String outsiderAuth = TestFixtures.authorization(jwt, sessions, outsider.owner());
    issue(email, outsiderAuth).andExpect(status().isForbidden());
    issue(workspace.owner().getEmail(), owner).andExpect(status().isConflict());
  }

  @Test
  void pendingListContainsOnlyUnusedUnexpiredInvitesAndNeverReturnsTheirTokens() throws Exception {
    String accepted = UUID.randomUUID() + "@example.test";
    signup(accepted, invite(accepted)).andExpect(status().isCreated());
    String expired = UUID.randomUUID() + "@example.test";
    invite(expired);
    jdbc.update(
        "update team_invitations set expires_at = CURRENT_TIMESTAMP - interval '1 minute' where team_id = ? and email = ?",
        workspace.team().getId(),
        expired);
    String original = invite(email);
    UUID originalId = pendingId(owner, email);
    String replacement = invite(email);
    UUID replacementId = pendingId(owner, email);
    assertThat(replacementId).isNotEqualTo(originalId);

    revoke(team, originalId, owner).andExpect(status().isNoContent());
    assertThat(pendingId(owner, email)).isEqualTo(replacementId);
    signup(email, original).andExpect(status().isBadRequest());

    var admin = memberAuthorization(TeamRole.ADMIN);
    assertThat(pendingId(admin, email)).isEqualTo(replacementId);
    revoke(team, replacementId, admin).andExpect(status().isNoContent());
    revoke(team, replacementId, admin).andExpect(status().isNoContent());
    list(owner).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    signup(email, replacement).andExpect(status().isBadRequest());

    UUID acceptedId =
        jdbc.queryForObject(
            "select id from team_invitations where team_id = ? and email = ?",
            UUID.class,
            workspace.team().getId(),
            accepted);
    revoke(team, acceptedId, admin).andExpect(status().isNoContent());
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_invitations where id = ? and consumed_at is not null",
                Long.class,
                acceptedId))
        .isEqualTo(1);
  }

  @Test
  void inviteManagementIsLimitedToManagersOfTheActiveTeam() throws Exception {
    invite(email);
    UUID id = pendingId(owner, email);
    var member = memberAuthorization(TeamRole.MEMBER);
    var outsider =
        transactions.execute(
            status -> {
              var other = TestFixtures.workspace(em);
              other.owner().setRole(UserRole.SUPER_ADMIN);
              return other;
            });
    var outsiderAuth = TestFixtures.authorization(jwt, sessions, outsider.owner());

    mvc.perform(get(team + "/invitations")).andExpect(status().isUnauthorized());
    for (String authorization : java.util.List.of(member, outsiderAuth)) {
      list(authorization).andExpect(status().isForbidden());
      revoke(team, id, authorization).andExpect(status().isForbidden());
    }
    revoke("/api/teams/" + outsider.team().getKey(), id, outsiderAuth)
        .andExpect(status().isNoContent());
    assertThat(pendingId(owner, email)).isEqualTo(id);

    jdbc.update(
        "update teams set deleted_at = CURRENT_TIMESTAMP where id = ?", workspace.team().getId());
    list(owner).andExpect(status().isNotFound());
    revoke(team, id, owner).andExpect(status().isNotFound());
  }

  @Test
  void listsInvitesAcrossPages() throws Exception {
    for (int i = 0; i < 11; i++) {
      invite(i + "-" + email);
    }
    list(owner)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(10))
        .andExpect(jsonPath("$.totalPages").value(2))
        .andExpect(jsonPath("$.totalElements").value(11));
    mvc.perform(get(team + "/invitations").param("page", "1").header("Authorization", owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.page").value(1))
        .andExpect(jsonPath("$.last").value(true));
  }

  @Test
  void concurrentRedemptionCreatesOneAccountAndMembership() throws Exception {
    String token = invite(email);
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first =
          executor.submit(
              () -> {
                start.await();
                return signup(email, token).andReturn().getResponse().getStatus();
              });
      var second =
          executor.submit(
              () -> {
                start.await();
                return signup(email, token).andReturn().getResponse().getStatus();
              });
      start.countDown();
      assertThat(
              java.util.List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(201, 400);
    }
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members m join users u on u.id = m.user_id where m.team_id = ? and u.email = ?",
                Long.class,
                workspace.team().getId(),
                email))
        .isEqualTo(1);
  }

  private ResultActions list(String authorization) throws Exception {
    return mvc.perform(get(team + "/invitations").header("Authorization", authorization));
  }

  private UUID pendingId(String authorization, String expectedEmail) throws Exception {
    String payload =
        list(authorization)
            .andExpect(status().isOk())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].email").value(expectedEmail))
            .andExpect(jsonPath("$.content[0].expiresAt").isString())
            .andExpect(jsonPath("$.content[0].token").doesNotExist())
            .andExpect(jsonPath("$.content[0].tokenHash").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return UUID.fromString(JsonPath.read(payload, "$.content[0].id"));
  }

  private ResultActions revoke(String team, UUID id, String authorization) throws Exception {
    return mvc.perform(delete(team + "/invitations/" + id).header("Authorization", authorization));
  }

  private String memberAuthorization(TeamRole role) {
    var user =
        transactions.execute(
            status -> {
              var member = TestFixtures.workspace(em).owner();
              var membership = new TeamMemberEntity();
              membership.setTeam(workspace.team());
              membership.setUser(member);
              membership.setAddedBy(workspace.owner());
              membership.setRole(role);
              em.persist(membership);
              return member;
            });
    return TestFixtures.authorization(jwt, sessions, user);
  }

  private String invite(String recipient) throws Exception {
    String response =
        issue(recipient, owner)
            .andExpect(status().isCreated())
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.expiresAt").isString())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(response, "$.token");
  }

  private ResultActions issue(String recipient, String authorization) throws Exception {
    return mvc.perform(
        post(team + "/invitations")
            .header("Authorization", authorization)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + recipient + "\"}"));
  }

  private ResultActions signup(String recipient, String token) throws Exception {
    String invitation = token == null ? "" : ",\"inviteToken\":\"" + token + "\"";
    return mvc.perform(
        post("/api/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                ("{\"email\":\"%s\",\"firstName\":\"Pilot\",\"lastName\":\"Member\","
                        + "\"password\":\"Strong123!\",\"confirmPassword\":\"Strong123!\"%s}")
                    .formatted(recipient, invitation)));
  }
}
