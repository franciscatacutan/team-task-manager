package com.example.task_manager.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doThrow;

import com.example.task_manager.activity.ActivityEventService;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionTemplate;

/** Use the real servlet container so failures reach its ERROR dispatch. */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class RequestFailureIntegrationTest extends PostgresIntegrationTest {
  private static final String PRIVATE_FAILURE = "Synthetic database failure detail";
  private static final String FAILED_TASK = "Reject this synthetic task";

  @LocalServerPort int port;
  @Autowired EntityManager em;
  @Autowired TransactionTemplate transactions;
  @Autowired JwtService jwt;
  @MockitoSpyBean ActivityEventService activities;
  @MockitoSpyBean RefreshTokenService sessions;
  @MockitoSpyBean AuthenticationManager authenticationManager;

  private Workspace workspace;
  private String authorization;

  @BeforeEach
  void setUp() {
    workspace =
        transactions.execute(
            status -> {
              var fixture = TestFixtures.workspace(em);
              fixture.project().setNextTaskNumber(2L);
              return fixture;
            });
    authorization = TestFixtures.authorization(jwt, sessions, workspace.owner());
  }

  @Test
  void failedSaveReturnsServerErrorRollsBackAndLeavesTheSessionUsable() throws Exception {
    doThrow(new DataAccessResourceFailureException(PRIVATE_FAILURE))
        .when(activities)
        .recordTaskEvent(
            argThat(task -> task != null && FAILED_TASK.equals(task.getName())),
            any(),
            eq(ActivityEventType.TASK_CREATED),
            any(),
            isNull());

    String path = workspace.taskPath().replace("/tasks/1", "/tasks");
    assertSafeServerFailure(call("POST", path, authorization, taskBody(FAILED_TASK)), path);
    assertThat(call("GET", "/api/users/me", authorization, null).statusCode()).isEqualTo(200);
    var list = call("GET", path, authorization, null);
    assertThat(list.statusCode()).isEqualTo(200);
    assertThat(JsonPath.<Integer>read(list.body(), "$.totalElements")).isEqualTo(1);

    var next = call("POST", path, authorization, taskBody("Retry with valid operation"));
    assertThat(next.statusCode()).isEqualTo(201);
    assertThat(JsonPath.<Integer>read(next.body(), "$.taskNumber")).isEqualTo(2);
  }

  @Test
  void aSessionLookupFailureAllowsRetryWithTheSameBearerAfterRecovery() throws Exception {
    var claims = jwt.parseAccessToken(authorization.substring("Bearer ".length()));
    doThrow(new DataAccessResourceFailureException(PRIVATE_FAILURE))
        .doCallRealMethod()
        .when(sessions)
        .isSessionActive(claims.sessionId(), claims.userId());

    assertSafeServerFailure(call("GET", "/api/users/me", authorization, null), "/api/users/me");
    assertThat(call("GET", "/api/users/me", authorization, null).statusCode()).isEqualTo(200);
  }

  @Test
  void signInInfrastructureFailureReturnsSafeServerError() throws Exception {
    String email = workspace.owner().getEmail();
    doThrow(new AuthenticationServiceException(PRIVATE_FAILURE))
        .when(authenticationManager)
        .authenticate(
            argThat(credentials -> credentials != null && email.equals(credentials.getName())));

    var response =
        call(
            "POST",
            "/api/auth/login",
            null,
            "{\"email\":\"%s\",\"password\":\"Synthetic1!\"}".formatted(email));
    assertSafeServerFailure(response, "/api/auth/login");
    assertThat(JsonPath.<String>read(response.body(), "$.error"))
        .isEqualTo("INTERNAL_SERVER_ERROR");
  }

  @Test
  void missingAndMalformedCredentialsAndDirectErrorRequestsStillRequireAuthentication()
      throws Exception {
    for (var response :
        List.of(
            call("GET", "/api/users/me", null, null),
            call("GET", "/api/users/me", "Bearer malformed", null),
            call("GET", "/error", null, null))) {
      assertThat(response.statusCode()).isEqualTo(401);
      assertThat(JsonPath.<String>read(response.body(), "$.error")).isEqualTo("UNAUTHORIZED");
    }
  }

  private void assertSafeServerFailure(HttpResponse<String> response, String originalPath) {
    assertThat(response.statusCode()).isEqualTo(500);
    assertThat(JsonPath.<Integer>read(response.body(), "$.status")).isEqualTo(500);
    assertThat(JsonPath.<String>read(response.body(), "$.path")).isEqualTo(originalPath);
    assertThat(response.body()).doesNotContain(PRIVATE_FAILURE, "\"trace\"", "\"exception\"");
    assertThat(response.headers().firstValue("Set-Cookie")).isEmpty();
  }

  private String taskBody(String name) {
    return """
        {"name":"%s","priority":"MEDIUM","assigneeId":"%s",
         "plannedStartDate":"2026-01-01","plannedDueDate":"2026-01-02"}
        """
        .formatted(name, workspace.owner().getId());
  }

  private HttpResponse<String> call(String method, String path, String bearer, String body)
      throws Exception {
    var builder =
        HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .timeout(Duration.ofSeconds(10))
            .header("Accept", "application/json");
    if (bearer != null) builder.header("Authorization", bearer);
    if (body != null) builder.header("Content-Type", "application/json");
    var publisher =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
    try (var client = HttpClient.newHttpClient()) {
      return client.send(
          builder.method(method, publisher).build(), HttpResponse.BodyHandlers.ofString());
    }
  }
}
