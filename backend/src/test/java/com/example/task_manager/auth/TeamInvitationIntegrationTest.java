package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
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
