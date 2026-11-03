package com.example.task_manager.user;

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
import jakarta.servlet.ServletException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

class UserEditingPrivacyIntegrationTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  @Autowired PasswordEncoder passwords;
  private final JsonMapper json = JsonMapper.builder().build();
  private final List<String[]> triggers = new ArrayList<>();
  private Workspace workspace;
  private MockMvc mvc;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @AfterEach
  void removeTriggers() {
    for (var trigger : triggers) {
      jdbc.execute("DROP TRIGGER IF EXISTS " + trigger[0] + " ON " + trigger[1]);
      jdbc.execute("DROP FUNCTION IF EXISTS " + trigger[0] + "()");
    }
    triggers.clear();
  }

  @Test
  void superAdminSavesAllFieldsAndRevokesAllTargetSessionsTogether() throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    var target = user(UserRole.USER, null);
    transactions.executeWithoutResult(
        status ->
            em.find(UserEntity.class, target.getId()).setPassword(passwords.encode("Password1!")));
    var first = sessions.createSession(target, "test", "JUnit");
    var second = sessions.createSession(target, "test", "JUnit");
    String previousBearer = "Bearer " + jwt.generateToken(target, first.familyId());
    String email = UUID.randomUUID() + "@example.test";
    edit(
            target,
            authorization(admin),
            Map.of(
                "firstName",
                " New ",
                "lastName",
                " Person ",
                "email",
                email.toUpperCase(),
                "role",
                "ADMIN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstName").value("New"))
        .andExpect(jsonPath("$.lastName").value("Person"))
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.role").value("ADMIN"));
    assertThat(sessions.isSessionActive(first.familyId(), target.getId())).isFalse();
    assertThat(sessions.isSessionActive(second.familyId(), target.getId())).isFalse();
    mvc.perform(get("/api/users/me").header("Authorization", previousBearer))
        .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("email", email, "password", "Password1!"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.user.role").value("ADMIN"));
  }

  @ParameterizedTest
  @CsvSource({
    "USER,USER,403",
    "ADMIN,USER,200",
    "ADMIN,ADMIN,200",
    "ADMIN,SUPER_ADMIN,403",
    "SUPER_ADMIN,USER,200",
    "SUPER_ADMIN,ADMIN,200",
    "SUPER_ADMIN,SUPER_ADMIN,200"
  })
  void existingManagementMatrixAppliesToAtomicEdits(
      UserRole viewerRole, UserRole targetRole, int expected) throws Exception {
    var viewer = user(viewerRole, null);
    var target = user(targetRole, null);
    var before = snapshot(target);
    edit(target, authorization(viewer), Map.of("firstName", "Changed"))
        .andExpect(status().is(expected));
    if (expected == 200) assertThat(snapshot(target).get("first_name")).isEqualTo("Changed");
    else assertThat(snapshot(target)).isEqualTo(before);
  }

  @Test
  void adminRoleInjectionRejectsTheWholeEditEvenForAnUnchangedRole() throws Exception {
    var admin = user(UserRole.ADMIN, null);
    var target = user(UserRole.USER, null);
    var before = snapshot(target);
    edit(target, authorization(admin), Map.of("firstName", "Must roll back", "role", "USER"))
        .andExpect(status().isForbidden());
    assertThat(snapshot(target)).isEqualTo(before);
  }

  @Test
  void duplicateEmailRejectsNamesAndRoleWithoutRevokingSessions() throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    var target = user(UserRole.USER, null);
    var occupied = user(UserRole.USER, null);
    var session = sessions.createSession(target, "test", "JUnit");
    var before = snapshot(target);
    edit(
            target,
            authorization(admin),
            Map.of(
                "firstName",
                "Changed",
                "lastName",
                "Changed",
                "email",
                occupied.getEmail().toUpperCase(),
                "role",
                "ADMIN"))
        .andExpect(status().isConflict());
    assertThat(snapshot(target)).isEqualTo(before);
    assertThat(sessions.isSessionActive(session.familyId(), target.getId())).isTrue();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "firstName",
        "lastName",
        "email",
        "longName",
        "longEmail",
        "invalidEmail",
        "invalidRole"
      })
  void invalidFieldsNeverPartiallySave(String scenario) throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    var target = user(UserRole.USER, null);
    var before = snapshot(target);
    var values = new java.util.HashMap<String, String>();
    values.put("firstName", "Changed");
    switch (scenario) {
      case "firstName", "lastName", "email" -> values.put(scenario, " ");
      case "longName" -> values.put("lastName", "x".repeat(101));
      case "longEmail" -> values.put("email", "x".repeat(145) + "@a.test");
      case "invalidEmail" -> values.put("email", "invalid");
      case "invalidRole" -> values.put("role", "OWNER");
    }
    edit(target, authorization(admin), values).andExpect(status().isBadRequest());
    assertThat(snapshot(target)).isEqualTo(before);
  }

  @Test
  void profileAndRoleOnlyChangesDoNotRevokeSessionsAndNoOpsRemainSafe() throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    var target = user(UserRole.USER, null);
    var session = sessions.createSession(target, "test", "JUnit");
    String bearer = "Bearer " + jwt.generateToken(target, session.familyId());
    edit(
            target,
            authorization(admin),
            Map.of(
                "firstName", "Changed", "role", "ADMIN", "email", target.getEmail().toUpperCase()))
        .andExpect(status().isOk());
    edit(target, authorization(admin), Map.of()).andExpect(status().isOk());
    assertThat(sessions.isSessionActive(session.familyId(), target.getId())).isTrue();
    mvc.perform(get("/api/users").header("Authorization", bearer)).andExpect(status().isOk());
  }

  @ParameterizedTest
  @EnumSource(
      value = UserRole.class,
      names = {"ADMIN", "SUPER_ADMIN"})
  void ownEmailStillRequiresTheSeparatePasswordProtectedFlow(UserRole role) throws Exception {
    var self = user(role, null);
    var before = snapshot(self);
    edit(
            self,
            authorization(self),
            Map.of("firstName", "Changed", "email", UUID.randomUUID() + "@example.test"))
        .andExpect(status().isForbidden());
    assertThat(snapshot(self)).isEqualTo(before);
  }

  @Test
  void superAdminCannotDemoteSelfThroughAtomicEditing() throws Exception {
    var self = user(UserRole.SUPER_ADMIN, null);
    var before = snapshot(self);
    edit(self, authorization(self), Map.of("firstName", "Changed", "role", "USER"))
        .andExpect(status().isForbidden());
    assertThat(snapshot(self)).isEqualTo(before);
  }

  @Test
  void regularSelfProfileEditStillWorksAndCannotInjectAdminFields() throws Exception {
    var self = user(UserRole.USER, null);
    String bearer = authorization(self);
    mvc.perform(
            patch("/api/users/" + self.getId())
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "firstName",
                            "Self",
                            "email",
                            "ignored@example.test",
                            "role",
                            "SUPER_ADMIN"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.firstName").value("Self"))
        .andExpect(jsonPath("$.email").value(self.getEmail()))
        .andExpect(jsonPath("$.role").value("USER"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"users", "refresh_tokens"})
  void databaseFailureRollsBackEveryEditAndSessionRevocation(String table) throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    var target = user(UserRole.USER, null);
    var session = sessions.createSession(target, "test", "JUnit");
    var before = snapshot(target);
    installFailure(table, target.getId());
    try {
      edit(
              target,
              authorization(admin),
              Map.of(
                  "firstName",
                  "Changed",
                  "lastName",
                  "Changed",
                  "email",
                  UUID.randomUUID() + "@example.test",
                  "role",
                  "ADMIN"))
          .andExpect(status().is5xxServerError());
    } catch (ServletException expected) {
      assertThat(expected).hasStackTraceContaining("atomic-fixture-failure");
    }
    assertThat(snapshot(target)).isEqualTo(before);
    assertThat(sessions.isSessionActive(session.familyId(), target.getId())).isTrue();
  }

  @Test
  void concurrentEmailCollisionHasOneWholeSuccessAndOneWholeFailure() throws Exception {
    var admin = user(UserRole.SUPER_ADMIN, null);
    String bearer = authorization(admin);
    String email = UUID.randomUUID() + "@example.test";
    var a = user(UserRole.USER, null);
    var b = user(UserRole.USER, null);
    var aBefore = snapshot(a);
    var bBefore = snapshot(b);
    var aSession = sessions.createSession(a, "test", "JUnit");
    var bSession = sessions.createSession(b, "test", "JUnit");
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var first =
          executor.submit(
              () -> {
                start.await();
                return edit(
                        a, bearer, Map.of("firstName", "Winner", "email", email, "role", "ADMIN"))
                    .andReturn()
                    .getResponse()
                    .getStatus();
              });
      var second =
          executor.submit(
              () -> {
                start.await();
                return edit(
                        b, bearer, Map.of("firstName", "Winner", "email", email, "role", "ADMIN"))
                    .andReturn()
                    .getResponse()
                    .getStatus();
              });
      start.countDown();
      assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(200, 409);
    }
    for (var target : List.of(a, b)) {
      var state = snapshot(target);
      boolean winner = email.equals(state.get("email"));
      if (winner) {
        assertThat(state.get("first_name")).isEqualTo("Winner");
        assertThat(state.get("role")).isEqualTo("ADMIN");
      } else assertThat(state).isEqualTo(target == a ? aBefore : bBefore);
      assertThat(
              sessions.isSessionActive(
                  target == a ? aSession.familyId() : bSession.familyId(), target.getId()))
          .isEqualTo(!winner);
    }
  }

  @ParameterizedTest
  @EnumSource(TeamRole.class)
  void currentTeammatesSeeNamesAndEmailWithoutGlobalRoles(TeamRole teamRole) throws Exception {
    var viewer = teamRole == TeamRole.OWNER ? workspace.owner() : user(UserRole.USER, teamRole);
    var target = user(UserRole.SUPER_ADMIN, TeamRole.MEMBER);
    profile(target, authorization(viewer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value(target.getEmail()))
        .andExpect(jsonPath("$.role").doesNotHaveJsonPath());
  }

  @ParameterizedTest
  @EnumSource(
      value = UserRole.class,
      names = {"ADMIN", "SUPER_ADMIN"})
  void globalAdminsSeeFullProfilesWithoutSharedMembership(UserRole role) throws Exception {
    var target = user(UserRole.SUPER_ADMIN, null);
    profile(target, authorization(user(role, null)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("SUPER_ADMIN"));
  }

  @ParameterizedTest
  @EnumSource(UserRole.class)
  void ownProfileRetainsItsGlobalRole(UserRole role) throws Exception {
    var self = user(role, null);
    profile(self, authorization(self))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value(role.name()));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void removingEitherCurrentMembershipEndsProfileAccess(boolean removeViewer) throws Exception {
    var viewer = user(UserRole.USER, TeamRole.MEMBER);
    var target = user(UserRole.USER, TeamRole.MEMBER);
    String bearer = authorization(viewer);
    profile(target, bearer).andExpect(status().isOk());
    jdbc.update(
        "delete from team_members where team_id = ? and user_id = ?",
        workspace.team().getId(),
        removeViewer ? viewer.getId() : target.getId());
    profile(target, bearer).andExpect(status().isNotFound());
  }

  @ParameterizedTest
  @EnumSource(TeamRole.class)
  void archivedTeamDoesNotAuthorizeLimitedProfileAccess(TeamRole role) throws Exception {
    var viewer = role == TeamRole.OWNER ? workspace.owner() : user(UserRole.USER, role);
    var target = user(UserRole.USER, TeamRole.MEMBER);
    jdbc.update(
        "update teams set deleted_at = ? where id = ?",
        java.sql.Timestamp.from(Instant.now()),
        workspace.team().getId());
    profile(target, authorization(viewer)).andExpect(status().isNotFound());
  }

  @Test
  void anotherActiveSharedTeamStillPermitsLimitedAccess() throws Exception {
    var viewer = user(UserRole.USER, TeamRole.MEMBER);
    var target = user(UserRole.ADMIN, TeamRole.MEMBER);
    transactions.executeWithoutResult(
        status -> {
          var other = TestFixtures.workspace(em);
          join(viewer, other.team(), TeamRole.MEMBER);
          join(target, other.team(), TeamRole.MEMBER);
        });
    jdbc.update(
        "update teams set deleted_at = ? where id = ?",
        java.sql.Timestamp.from(Instant.now()),
        workspace.team().getId());
    profile(target, authorization(viewer))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").doesNotHaveJsonPath());
  }

  @Test
  void unsharedAndUnknownProfilesHaveTheSameNotFoundResponseAndDirectoryRemainsRestricted()
      throws Exception {
    var viewer = user(UserRole.USER, null);
    var target = user(UserRole.USER, null);
    String bearer = authorization(viewer);
    profile(target, bearer)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("User not found."));
    mvc.perform(get("/api/users/" + UUID.randomUUID()).header("Authorization", bearer))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("User not found."));
    mvc.perform(get("/api/users").header("Authorization", bearer))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/users/" + target.getId())).andExpect(status().isUnauthorized());
  }

  @Test
  void memberListsPreserveEmailsAndTeamRolesButExposeOnlyTheViewersOwnGlobalRole()
      throws Exception {
    var viewer = user(UserRole.USER, TeamRole.ADMIN);
    var target = user(UserRole.SUPER_ADMIN, TeamRole.MEMBER);
    String bearer = authorization(viewer);
    mvc.perform(
            get(teamPath() + "/members")
                .header("Authorization", bearer)
                .param("search", target.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].email").value(target.getEmail()))
        .andExpect(jsonPath("$.content[0].teamRole").value("MEMBER"))
        .andExpect(jsonPath("$.content[0].globalRole").doesNotHaveJsonPath());
    mvc.perform(
            get(teamPath() + "/members")
                .header("Authorization", bearer)
                .param("search", viewer.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].globalRole").value("USER"));
  }

  @ParameterizedTest
  @EnumSource(
      value = UserRole.class,
      names = {"ADMIN", "SUPER_ADMIN"})
  void globalAdminsRetainMemberAndCandidateRoleVisibility(UserRole role) throws Exception {
    var member = user(UserRole.SUPER_ADMIN, TeamRole.MEMBER);
    var candidate = user(UserRole.ADMIN, null);
    String bearer = authorization(user(role, null));
    mvc.perform(
            get(teamPath() + "/members")
                .header("Authorization", bearer)
                .param("search", member.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].globalRole").value("SUPER_ADMIN"));
    mvc.perform(
            get(teamPath() + "/available-users")
                .header("Authorization", bearer)
                .param("search", candidate.getEmail())
                .param("sort", "role,asc"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].role").value("ADMIN"));
  }

  @Test
  void teamManagersCanSearchCandidateEmailsButCannotReadOrSortTheirGlobalRole() throws Exception {
    var candidate = user(UserRole.SUPER_ADMIN, null);
    String bearer = authorization(workspace.owner());
    mvc.perform(
            get(teamPath() + "/available-users")
                .header("Authorization", bearer)
                .param("search", candidate.getEmail()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].email").value(candidate.getEmail()))
        .andExpect(jsonPath("$.content[0].role").doesNotHaveJsonPath());
    mvc.perform(
            get(teamPath() + "/available-users")
                .header("Authorization", bearer)
                .param("sort", "role,asc"))
        .andExpect(status().isBadRequest());
    profile(candidate, bearer).andExpect(status().isNotFound());
  }

  @ParameterizedTest
  @ValueSource(strings = {"add", "role", "ownership"})
  void membershipWriteResponsesDoNotRevealAnotherPersonsGlobalRole(String operation)
      throws Exception {
    var target = user(UserRole.SUPER_ADMIN, operation.equals("add") ? null : TeamRole.MEMBER);
    String bearer = authorization(workspace.owner());
    if (operation.equals("add")) {
      mvc.perform(
              post(teamPath() + "/members")
                  .header("Authorization", bearer)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(
                      json.writeValueAsString(
                          Map.of(
                              "members",
                              List.of(Map.of("userId", target.getId(), "role", "MEMBER"))))))
          .andExpect(status().isCreated())
          .andExpect(jsonPath("$.success[0].globalRole").doesNotHaveJsonPath());
    } else {
      String route =
          operation.equals("role")
              ? "/members/" + target.getId() + "/role"
              : "/transfer/" + target.getId();
      mvc.perform(
              patch(teamPath() + route)
                  .header("Authorization", bearer)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"role\":\"ADMIN\"}"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.globalRole").doesNotHaveJsonPath());
    }
  }

  private ResultActions edit(UserEntity target, String bearer, Map<String, ?> fields)
      throws Exception {
    return mvc.perform(
        patch("/api/admin/users/" + target.getId())
            .header("Authorization", bearer)
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(fields)));
  }

  private ResultActions profile(UserEntity target, String bearer) throws Exception {
    return mvc.perform(get("/api/users/" + target.getId()).header("Authorization", bearer));
  }

  private String teamPath() {
    return "/api/teams/" + workspace.team().getKey();
  }

  private String authorization(UserEntity user) {
    return TestFixtures.authorization(jwt, sessions, user);
  }

  private Map<String, Object> snapshot(UserEntity user) {
    return jdbc.queryForMap(
        "select first_name, last_name, email, role, version from users where id = ?", user.getId());
  }

  private UserEntity user(UserRole role, TeamRole teamRole) {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setFirstName("Original");
          user.setLastName("Person");
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setPassword("not-used-by-bearer-tests");
          user.setRole(role);
          em.persist(user);
          if (teamRole != null) join(user, workspace.team(), teamRole);
          em.flush();
          return user;
        });
  }

  private void join(UserEntity user, TeamEntity team, TeamRole role) {
    var member = new TeamMemberEntity();
    member.setTeam(em.find(TeamEntity.class, team.getId()));
    member.setUser(em.find(UserEntity.class, user.getId()));
    member.setRole(role);
    member.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
    em.persist(member);
  }

  private void installFailure(String table, UUID target) {
    String name = "test_atomic_" + UUID.randomUUID().toString().replace("-", "");
    String field = table.equals("users") ? "id" : "user_id";
    jdbc.execute(
        "CREATE FUNCTION "
            + name
            + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."
            + field
            + " = '"
            + target
            + "'::uuid THEN RAISE EXCEPTION 'atomic-fixture-failure'; END IF; RETURN NEW; END $$");
    triggers.add(new String[] {name, table});
    jdbc.execute(
        "CREATE TRIGGER "
            + name
            + " BEFORE UPDATE ON "
            + table
            + " FOR EACH ROW EXECUTE FUNCTION "
            + name
            + "()");
  }
}
