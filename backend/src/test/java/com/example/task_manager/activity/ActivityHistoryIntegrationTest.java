package com.example.task_manager.activity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class ActivityHistoryIntegrationTest extends PostgresIntegrationTest {
  enum Scope {
    TEAM,
    PROJECT,
    TASK
  }

  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JdbcTemplate jdbc;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private final JsonMapper json = JsonMapper.builder().build();
  private MockMvc mvc;
  private Workspace workspace;
  private Workspace foreign;
  private String bearer;
  private static final Instant CREATED = Instant.parse("2026-11-04T00:00:00Z");

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    foreign = transactions.execute(status -> TestFixtures.workspace(em));
    bearer = TestFixtures.authorization(jwt, sessions, workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @ParameterizedTest
  @EnumSource(Scope.class)
  void searchesBeforePagingAndCountsOnlyAuthorizedMatches(Scope scope) throws Exception {
    for (int i = 0; i < 25; i++)
      seed(
          workspace,
          i == 24 ? "Older NEEDLE match" : "Ordinary event " + i,
          CREATED.minusSeconds(i),
          "TASK_COMMENTED");
    seed(foreign, "Foreign needle match", CREATED, "TASK_COMMENTED");
    mvc.perform(get(path(scope)).header("Authorization", bearer).param("size", "10"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(25))
        .andExpect(jsonPath("$.totalPages").value(3));
    mvc.perform(
            get(path(scope))
                .header("Authorization", bearer)
                .param("size", "10")
                .param("search", "  needle  "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.totalPages").value(1))
        .andExpect(jsonPath("$.content[0].message").value("Older NEEDLE match"));
    mvc.perform(
            get(path(scope))
                .header("Authorization", bearer)
                .param("size", "10")
                .param("search", "ordinary")
                .param("page", "2"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(24))
        .andExpect(jsonPath("$.content.length()").value(4));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "Test Owner",
        "@example.test",
        "Historical task",
        "Historical project",
        "Historical team",
        "comment",
        "TASK_COMMENTED",
        "Original task"
      })
  void searchesActorIdentityCurrentNamesSnapshotsAndTypeLabels(String search) throws Exception {
    seed(workspace, "Ordinary message", CREATED, "TASK_COMMENTED");
    assertThat(read(path(Scope.TEAM), search).get("totalElements").asLong()).isEqualTo(1);
  }

  @Test
  void searchesCurrentProjectKeyAndTaskNumberAndReturnsPublicRoutes() throws Exception {
    seed(workspace, "A message", CREATED, "TASK_COMMENTED");
    assertThat(read(path(Scope.TEAM), workspace.project().getKey()).get("totalElements").asLong())
        .isEqualTo(1);
    var response = read(path(Scope.TEAM), "1").get("content").get(0);
    assertThat(response.get("task").get("taskNumber").asLong()).isEqualTo(1);
    assertThat(response.get("task").get("id").asText())
        .isEqualTo(workspace.task().getId().toString());
    assertThat(response.get("project").get("key").asText()).isEqualTo(workspace.project().getKey());
    assertThat(response.get("targetPath").asText())
        .isEqualTo(path(Scope.TASK).replace("/api", "").replace("/activities", ""));
  }

  @Test
  void escapesLiteralWildcardCharactersAndSupportsArchivedTypeLabel() throws Exception {
    seed(workspace, "Budget 50%_done", CREATED, "TASK_COMMENTED");
    seed(workspace, "Budget 50XXdone", CREATED.minusSeconds(1), "TASK_COMMENTED");
    seed(workspace, "Removal marker", CREATED.minusSeconds(2), "TASK_DELETED");
    assertThat(read(path(Scope.TASK), "50%_").get("totalElements").asLong()).isEqualTo(1);
    assertThat(read(path(Scope.TASK), "Archived").get("totalElements").asLong()).isEqualTo(1);
    assertThat(read(path(Scope.TASK), "no such phrase").get("totalElements").asLong()).isZero();
  }

  @Test
  void timestampTiesHaveStableAscendingAndDescendingPagination() throws Exception {
    var ids = new ArrayList<String>();
    for (int i = 0; i < 9; i++)
      ids.add(seed(workspace, "Tied event", CREATED, "TASK_COMMENTED").toString());
    for (String direction : List.of("asc", "desc")) {
      var actual = new ArrayList<String>();
      for (int page = 0; page < 3; page++) {
        var result =
            json.readTree(
                mvc.perform(
                        get(path(Scope.TASK))
                            .header("Authorization", bearer)
                            .param("size", "3")
                            .param("page", String.valueOf(page))
                            .param("sort", "createdAt," + direction))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString());
        for (JsonNode item : result.get("content")) actual.add(item.get("id").asText());
      }
      var expected =
          ids.stream()
              .sorted(
                  direction.equals("asc") ? Comparator.naturalOrder() : Comparator.reverseOrder())
              .toList();
      assertThat(actual).containsExactlyElementsOf(expected);
    }
  }

  @ParameterizedTest
  @EnumSource(Scope.class)
  void removedMembersCannotSearchHistoryAndArchiveRulesArePreserved(Scope scope) throws Exception {
    seed(workspace, "Confidential history", CREATED, "TASK_COMMENTED");
    String outsider = TestFixtures.authorization(jwt, sessions, foreign.owner());
    mvc.perform(get(path(scope)).header("Authorization", outsider).param("search", "Confidential"))
        .andExpect(status().isNotFound());
    transactions.executeWithoutResult(
        status -> em.find(TaskEntity.class, workspace.task().getId()).setDeletedAt(Instant.now()));
    // Team owner retains archived task reads and a usable task link.
    var row = read(path(scope), "Confidential").get("content").get(0);
    assertThat(row.get("targetPath").asText()).contains("/tasks/1");
  }

  @Test
  void rejectsUnsupportedSortAndOverlongSearchWithoutChangingReadScope() throws Exception {
    mvc.perform(
            get(path(Scope.TASK))
                .header("Authorization", bearer)
                .param("sort", "user.password,desc"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get(path(Scope.PROJECT))
                .header("Authorization", bearer)
                .param("search", "x".repeat(201)))
        .andExpect(status().isBadRequest());
    mvc.perform(get(path(Scope.TEAM)).header("Authorization", bearer).param("search", " "))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @ParameterizedTest
  @EnumSource(
      value = Scope.class,
      names = {"TEAM", "PROJECT"})
  void regularMembersKeepHistoricalRowsButReceiveNoArchivedTaskLink(Scope scope) throws Exception {
    seed(workspace, "Retained event", CREATED, "TASK_COMMENTED");
    transactions.executeWithoutResult(
        status -> {
          var member = new TeamMemberEntity();
          member.setTeam(em.find(TeamEntity.class, workspace.team().getId()));
          member.setUser(em.find(UserEntity.class, foreign.owner().getId()));
          member.setAddedBy(em.find(UserEntity.class, workspace.owner().getId()));
          member.setRole(TeamRole.MEMBER);
          em.persist(member);
          em.find(TaskEntity.class, workspace.task().getId()).setDeletedAt(Instant.now());
        });
    String member = TestFixtures.authorization(jwt, sessions, foreign.owner());
    mvc.perform(get(path(scope)).header("Authorization", member))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(1))
        .andExpect(jsonPath("$.content[0].message").value("Retained event"))
        .andExpect(jsonPath("$.content[0].targetPath").isEmpty());
    mvc.perform(get(workspace.taskPath()).header("Authorization", member))
        .andExpect(status().isNotFound());
  }

  @Test
  void commentWriteResponseAlsoContainsCurrentTaskNumberAndAuthorizedRoute() throws Exception {
    mvc.perform(
            post(workspace.taskPath() + "/activities")
                .header("Authorization", bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"New comment\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.task.taskNumber").value(1))
        .andExpect(jsonPath("$.task.id").value(workspace.task().getId().toString()))
        .andExpect(jsonPath("$.targetPath").value(workspace.taskPath().replace("/api", "")));
  }

  private JsonNode read(String path, String search) throws Exception {
    return json.readTree(
        mvc.perform(get(path).header("Authorization", bearer).param("search", search))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  private String path(Scope scope) {
    return switch (scope) {
      case TEAM -> "/api/teams/" + workspace.team().getKey() + "/activities";
      case PROJECT ->
          "/api/teams/"
              + workspace.team().getKey()
              + "/projects/"
              + workspace.project().getKey()
              + "/activities";
      case TASK -> workspace.taskPath() + "/activities";
    };
  }

  private UUID seed(Workspace space, String message, Instant created, String type) {
    var id = UUID.randomUUID();
    String details =
        "{\"team\":{\"id\":\""
            + space.team().getId()
            + "\",\"label\":\"Historical team\"},\"project\":{\"id\":\""
            + space.project().getId()
            + "\",\"label\":\"Historical project\"},\"task\":{\"id\":\""
            + space.task().getId()
            + "\",\"label\":\"Historical task\"}}";
    jdbc.update(
        "INSERT INTO activity_events (id,team_id,project_id,task_id,entity_type,entity_id,event_type,details_json,message,user_id,created_at) VALUES (?,?,?,?,'TASK',?,?,cast(? as jsonb),?,?,?)",
        id,
        space.team().getId(),
        space.project().getId(),
        space.task().getId(),
        space.task().getId(),
        type,
        details,
        message,
        space.owner().getId(),
        Timestamp.from(created));
    return id;
  }
}
