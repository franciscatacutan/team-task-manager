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
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class TeamMembershipBatchIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private Workspace workspace;
  private MockMvc mvc;
  private String authorization;
  private final List<String[]> triggers = new ArrayList<>();

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    authorization = TestFixtures.authorization(jwt, sessions, workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @AfterEach
  void dropTestTriggers() {
    for (var trigger : triggers) {
      jdbc.execute("DROP TRIGGER IF EXISTS " + trigger[0] + " ON " + trigger[1]);
      jdbc.execute("DROP FUNCTION IF EXISTS " + trigger[0] + "()");
    }
    triggers.clear();
  }

  @Test
  void mixedAddsCommitValidUsersAndReportAnUnknownUser() throws Exception {
    var first = user(null);
    var last = user(null);
    UUID unknown = UUID.randomUUID();
    batch("ADD", ids(first.getId(), unknown, last.getId()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success.length()").value(2))
        .andExpect(jsonPath("$.failed.length()").value(1))
        .andExpect(jsonPath("$.failed[0].userId").value(unknown.toString()))
        .andExpect(jsonPath("$.failed[0].code").value("NOT_FOUND"));
    assertMembership(first.getId(), true);
    assertMembership(last.getId(), true);
    assertRecords(2);
  }

  @Test
  void mixedRemovalsKeepTheOwnerAndRemoveBothRegularMembers() throws Exception {
    var first = user(TeamRole.MEMBER);
    var last = user(TeamRole.MEMBER);
    batch("REMOVE", ids(first.getId(), workspace.owner().getId(), last.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success.length()").value(2))
        .andExpect(
            jsonPath("$.failed[0].reason").value("Transfer ownership before removing OWNER"));
    assertMembership(first.getId(), false);
    assertMembership(last.getId(), false);
    assertMembership(workspace.owner().getId(), true);
    assertRecords(2);
  }

  @Test
  void teamAdminCanAddRegularMembersButCannotGrantAdminWithinTheSameBatch() throws Exception {
    authorization = TestFixtures.authorization(jwt, sessions, user(TeamRole.ADMIN));
    var regular = user(null);
    var adminCandidate = user(null);
    String body =
        "{\"members\":[{\"userId\":\""
            + regular.getId()
            + "\",\"role\":\"MEMBER\"},{\"userId\":\""
            + adminCandidate.getId()
            + "\",\"role\":\"ADMIN\"}]}";
    send("ADD", body)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success.length()").value(1))
        .andExpect(jsonPath("$.failed[0].code").value("FORBIDDEN"));
    assertMembership(regular.getId(), true);
    assertMembership(adminCandidate.getId(), false);
    assertRecords(1);
  }

  @Test
  void teamAdminCanRemoveRegularMembersButCannotRemoveAnotherAdmin() throws Exception {
    authorization = TestFixtures.authorization(jwt, sessions, user(TeamRole.ADMIN));
    var regular = user(TeamRole.MEMBER);
    var otherAdmin = user(TeamRole.ADMIN);
    batch("REMOVE", ids(otherAdmin.getId(), regular.getId()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success.length()").value(1))
        .andExpect(jsonPath("$.failed[0].code").value("FORBIDDEN"));
    assertMembership(regular.getId(), false);
    assertMembership(otherAdmin.getId(), true);
    assertRecords(1);
  }

  @ParameterizedTest
  @ValueSource(strings = {"ADD", "REMOVE"})
  void allFailedBatchesHaveNoSideEffects(String operation) throws Exception {
    batch(operation, ids(workspace.owner().getId(), UUID.randomUUID()))
        .andExpect(operation.equals("ADD") ? status().isCreated() : status().isOk())
        .andExpect(jsonPath("$.success.length()").value(0))
        .andExpect(jsonPath("$.failed.length()").value(2));
    assertMembership(workspace.owner().getId(), true);
    assertRecords(0);
  }

  @ParameterizedTest
  @CsvSource({
    "ADD,MEMBERSHIP",
    "ADD,ACTIVITY",
    "ADD,AUDIT",
    "ADD,NOTIFICATION",
    "REMOVE,MEMBERSHIP",
    "REMOVE,ACTIVITY",
    "REMOVE,AUDIT",
    "REMOVE,NOTIFICATION"
  })
  void realDatabaseFailuresRollBackOnlyTheirEntryIncludingAllItsSideEffects(
      String operation, String stage) throws Exception {
    TeamRole role = operation.equals("ADD") ? null : TeamRole.MEMBER;
    var before = user(role);
    var failing = user(role);
    var after = user(role);
    installFailure(operation, stage, failing.getId());
    var result =
        batch(operation, ids(before.getId(), failing.getId(), after.getId()))
            .andExpect(operation.equals("ADD") ? status().isCreated() : status().isOk())
            .andExpect(jsonPath("$.success.length()").value(2))
            .andExpect(jsonPath("$.failed.length()").value(1))
            .andExpect(jsonPath("$.failed[0].userId").value(failing.getId().toString()))
            .andExpect(jsonPath("$.failed[0].code").value("MEMBER_CHANGE_FAILED"))
            .andReturn();
    assertThat(result.getResponse().getContentAsString())
        .doesNotContain("private-db-details", "insert into", "PL/pgSQL");
    boolean added = operation.equals("ADD");
    assertMembership(before.getId(), added);
    assertMembership(after.getId(), added);
    assertMembership(failing.getId(), !added);
    assertRecords(2);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from notifications where team_id = ? and recipient_id = ?",
                Long.class,
                workspace.team().getId(),
                failing.getId()))
        .isZero();
  }

  @ParameterizedTest
  @ValueSource(strings = {"ADD", "REMOVE"})
  void duplicateIdsAreRejectedBeforeAnyChanges(String operation) throws Exception {
    var candidate = user(operation.equals("ADD") ? null : TeamRole.MEMBER);
    batch(operation, ids(candidate.getId(), candidate.getId())).andExpect(status().isBadRequest());
    assertMembership(candidate.getId(), operation.equals("REMOVE"));
    assertRecords(0);
  }

  @ParameterizedTest
  @ValueSource(strings = {"ADD", "REMOVE"})
  void nullEntriesAreRejectedBeforeAnyChanges(String operation) throws Exception {
    send(operation, operation.equals("ADD") ? "{\"members\":[null]}" : "{\"userIds\":[null]}")
        .andExpect(status().isBadRequest());
    assertRecords(0);
  }

  @Test
  void eachEntryRechecksManagerPermissionsAfterThePriorCommit() throws Exception {
    var admin = user(TeamRole.ADMIN);
    var first = user(null);
    var second = user(null);
    authorization = TestFixtures.authorization(jwt, sessions, admin);
    installTrigger(
        "team_members",
        "AFTER INSERT",
        "IF NEW.team_id = '"
            + workspace.team().getId()
            + "'::uuid AND NEW.user_id = '"
            + first.getId()
            + "'::uuid THEN UPDATE team_members SET role = 'MEMBER' WHERE team_id = NEW.team_id AND user_id = '"
            + admin.getId()
            + "'::uuid; END IF;",
        "NEW");
    batch("ADD", ids(first.getId(), second.getId()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success.length()").value(1))
        .andExpect(jsonPath("$.failed[0].userId").value(second.getId().toString()))
        .andExpect(jsonPath("$.failed[0].code").value("FORBIDDEN"));
    assertMembership(first.getId(), true);
    assertMembership(second.getId(), false);
    assertRecords(1);
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void concurrentAddsDoNotDuplicateMembershipOrLoseUnrelatedChanges(boolean sameUser)
      throws Exception {
    var first = user(null);
    var second = sameUser ? first : user(null);
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a =
          executor.submit(
              () -> {
                await(start);
                return batch("ADD", ids(first.getId()))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
              });
      var b =
          executor.submit(
              () -> {
                await(start);
                return batch("ADD", ids(second.getId()))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
              });
      start.countDown();
      String resultA = a.get(15, TimeUnit.SECONDS), resultB = b.get(15, TimeUnit.SECONDS);
      int succeeded =
          ((List<?>) JsonPath.read(resultA, "$.success")).size()
              + ((List<?>) JsonPath.read(resultB, "$.success")).size();
      int failed =
          ((List<?>) JsonPath.read(resultA, "$.failed")).size()
              + ((List<?>) JsonPath.read(resultB, "$.failed")).size();
      assertThat(succeeded).isEqualTo(sameUser ? 1 : 2);
      assertThat(failed).isEqualTo(sameUser ? 1 : 0);
      assertMembership(first.getId(), true);
      assertMembership(second.getId(), true);
      assertRecords(sameUser ? 1 : 2);
    } finally {
      start.countDown();
    }
  }

  private void installFailure(String operation, String stage, UUID userId) {
    String table =
        switch (stage) {
          case "MEMBERSHIP" -> "team_members";
          case "ACTIVITY" -> "activity_events";
          case "AUDIT" -> "audit_logs";
          default -> "notifications";
        };
    String record = stage.equals("MEMBERSHIP") && operation.equals("REMOVE") ? "OLD" : "NEW";
    String subject =
        switch (stage) {
          case "MEMBERSHIP" -> record + ".user_id = '" + userId + "'::uuid";
          case "ACTIVITY" -> "NEW.details_json->'subjectUser'->>'id' = '" + userId + "'";
          case "AUDIT" -> "NEW.metadata_json->'subjectUser'->>'id' = '" + userId + "'";
          default -> "NEW.recipient_id = '" + userId + "'::uuid";
        };
    installTrigger(
        table,
        "BEFORE " + (record.equals("OLD") ? "DELETE" : "INSERT"),
        "IF "
            + record
            + ".team_id = '"
            + workspace.team().getId()
            + "'::uuid AND "
            + subject
            + " THEN RAISE EXCEPTION 'private-db-details'; END IF;",
        record);
  }

  private void installTrigger(String table, String event, String body, String record) {
    String name = "test_batch_" + UUID.randomUUID().toString().replace("-", "");
    jdbc.execute(
        "CREATE FUNCTION "
            + name
            + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN "
            + body
            + " RETURN "
            + record
            + "; END $$");
    triggers.add(new String[] {name, table});
    jdbc.execute(
        "CREATE TRIGGER "
            + name
            + " "
            + event
            + " ON "
            + table
            + " FOR EACH ROW EXECUTE FUNCTION "
            + name
            + "()");
  }

  private ResultActions batch(String operation, List<UUID> ids) throws Exception {
    String entries =
        operation.equals("ADD")
            ? ids.stream()
                .map(id -> "{\"userId\":\"" + id + "\",\"role\":\"MEMBER\"}")
                .collect(java.util.stream.Collectors.joining(","))
            : ids.stream()
                .map(id -> "\"" + id + "\"")
                .collect(java.util.stream.Collectors.joining(","));
    return send(
        operation,
        "{\"" + (operation.equals("ADD") ? "members" : "userIds") + "\":[" + entries + "]}");
  }

  private ResultActions send(String operation, String json) throws Exception {
    var request = operation.equals("ADD") ? post(path()) : delete(path());
    return mvc.perform(
        request
            .header("Authorization", authorization)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  private String path() {
    return "/api/teams/" + workspace.team().getKey() + "/members";
  }

  private List<UUID> ids(UUID... ids) {
    return List.of(ids);
  }

  private UserEntity user(TeamRole role) {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Batch");
          user.setLastName("User");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("unused");
          user.setRole(UserRole.USER);
          em.persist(user);
          if (role != null) {
            var member = new TeamMemberEntity();
            member.setTeam(
                em.find(
                    com.example.task_manager.team.entity.TeamEntity.class,
                    workspace.team().getId()));
            member.setUser(user);
            member.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
            member.setRole(role);
            em.persist(member);
          }
          return user;
        });
  }

  private void assertMembership(UUID userId, boolean exists) {
    assertThat(
            jdbc.queryForObject(
                "select count(*) from team_members where team_id = ? and user_id = ?",
                Long.class,
                workspace.team().getId(),
                userId))
        .isEqualTo(exists ? 1 : 0);
  }

  private void assertRecords(long count) {
    for (String table : List.of("activity_events", "audit_logs", "notifications"))
      assertThat(
              jdbc.queryForObject(
                  "select count(*) from " + table + " where team_id = ?",
                  Long.class,
                  workspace.team().getId()))
          .as(table)
          .isEqualTo(count);
  }

  private void await(CountDownLatch latch) {
    try {
      if (!latch.await(10, TimeUnit.SECONDS))
        throw new IllegalStateException("Batch race timed out");
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(ex);
    }
  }
}
