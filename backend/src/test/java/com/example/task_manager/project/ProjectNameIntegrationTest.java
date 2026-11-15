package com.example.task_manager.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class ProjectNameIntegrationTest extends PostgresIntegrationTest {
  private static final String CONFLICT_MESSAGE = "Project name already exists in this team";

  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private MockMvc mvc;
  private Workspace workspace;
  private String ownerAuth;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
    ownerAuth = TestFixtures.authorization(jwt, sessions, workspace.owner());
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void namesIgnoreCaseAndOuterSpacesAndCanBeReusedAfterArchiveOrInAnotherTeam() throws Exception {
    String path = projectPath(create("Release Plan"));
    rename(path, "release plan", "Preserve casing changes").andExpect(status().isOk());
    mvc.perform(
            patch(path + "/status")
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"COMPLETED\"}"))
        .andExpect(status().isOk());
    mvc.perform(
            post(projectsPath(workspace))
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"  RELEASE PLAN  \"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value(CONFLICT_MESSAGE));

    var otherTeam = transactions.execute(status -> TestFixtures.workspace(em));
    mvc.perform(
            post(projectsPath(otherTeam))
                .header(
                    "Authorization", TestFixtures.authorization(jwt, sessions, otherTeam.owner()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Release Plan\"}"))
        .andExpect(status().isCreated());

    mvc.perform(delete(path).header("Authorization", ownerAuth)).andExpect(status().isNoContent());
    assertThat(create("  RELEASE PLAN  ")).isNotEqualTo(path.substring(path.lastIndexOf('/') + 1));
    mvc.perform(get(path).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("release plan"))
        .andExpect(jsonPath("$.deletedAt").isNotEmpty());
  }

  @Test
  void concurrentCreatesSaveOneProjectAndReportOneNameConflict() throws Exception {
    var responses =
        race(() -> postProject("Shared Delivery"), () -> postProject("  shared DELIVERY  "));
    assertThat(responses)
        .extracting(MockHttpServletResponse::getStatus)
        .containsExactlyInAnyOrder(201, 409);
    assertConflict(responses);
    assertMatchingProjects("shared delivery", 1);
  }

  @Test
  void concurrentRenamesPreserveTheLosingProjectWithoutPartialEdits() throws Exception {
    String first = projectPath(create("First project"));
    String second = projectPath(create("Second project"));
    var responses =
        race(
            () -> rename(first, "Shared name", "First update").andReturn().getResponse(),
            () -> rename(second, "  Shared NAME  ", "Second update").andReturn().getResponse());
    assertThat(responses)
        .extracting(MockHttpServletResponse::getStatus)
        .containsExactlyInAnyOrder(200, 409);
    assertConflict(responses);
    boolean firstLost = responses.getFirst().getStatus() == 409;
    mvc.perform(get(firstLost ? first : second).header("Authorization", ownerAuth))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value(firstLost ? "First project" : "Second project"))
        .andExpect(jsonPath("$.description").isEmpty());
    assertMatchingProjects("shared name", 1);
  }

  private void assertMatchingProjects(String search, int expected) throws Exception {
    mvc.perform(
            get(projectsPath(workspace)).header("Authorization", ownerAuth).param("search", search))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(expected));
  }

  private static void assertConflict(List<MockHttpServletResponse> responses) throws Exception {
    var conflict =
        responses.stream()
            .filter(response -> response.getStatus() == 409)
            .findFirst()
            .orElseThrow();
    assertThat(JsonPath.<String>read(conflict.getContentAsString(), "$.message"))
        .isEqualTo(CONFLICT_MESSAGE);
  }

  private static List<MockHttpServletResponse> race(
      Callable<MockHttpServletResponse> first, Callable<MockHttpServletResponse> second)
      throws Exception {
    var ready = new CountDownLatch(2);
    var start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a = executor.submit(() -> runWhenReady(first, ready, start));
      var b = executor.submit(() -> runWhenReady(second, ready, start));
      try {
        assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      } finally {
        start.countDown();
      }
      return List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
    }
  }

  private static MockHttpServletResponse runWhenReady(
      Callable<MockHttpServletResponse> operation, CountDownLatch ready, CountDownLatch start)
      throws Exception {
    ready.countDown();
    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
    return operation.call();
  }

  private String create(String name) throws Exception {
    var response = postProject(name);
    assertThat(response.getStatus()).isEqualTo(201);
    return JsonPath.read(response.getContentAsString(), "$.key");
  }

  private MockHttpServletResponse postProject(String name) throws Exception {
    return mvc.perform(
            post(projectsPath(workspace))
                .header("Authorization", ownerAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"%s\"}".formatted(name)))
        .andReturn()
        .getResponse();
  }

  private ResultActions rename(String path, String name, String description) throws Exception {
    return mvc.perform(
        patch(path)
            .header("Authorization", ownerAuth)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"%s\",\"description\":\"%s\"}".formatted(name, description)));
  }

  private String projectPath(String key) {
    return projectsPath(workspace) + "/" + key;
  }

  private static String projectsPath(Workspace workspace) {
    return "/api/teams/" + workspace.team().getKey() + "/projects";
  }
}
