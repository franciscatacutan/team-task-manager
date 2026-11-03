package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.example.task_manager.auth.dto.LoginRequest;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.exception.api.AuthException;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import com.example.task_manager.user.UserService;
import com.example.task_manager.user.dto.AdminResetPasswordRequest;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import com.jayway.jsonpath.JsonPath;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

class SessionRevocationIntegrationTest extends PostgresIntegrationTest {
  private static final String PASSWORD = "OldPassword123!";
  private static final String NEXT_PASSWORD = "NewPassword456!";
  private static final String ORIGIN = "http://localhost:5173";
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired AuthService auth;
  @Autowired RefreshTokenService sessions;
  @Autowired RefreshTokenRepository tokens;
  @Autowired JwtService jwt;
  @Autowired PasswordEncoder passwords;
  @Autowired UserService users;
  private MockMvc mvc;
  private Workspace workspace;

  @BeforeEach
  void setUp() {
    workspace =
        transactions.execute(
            status -> {
              var value = TestFixtures.workspace(em);
              value.owner().setPassword(passwords.encode(PASSWORD));
              return value;
            });
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  @Test
  void logoutImmediatelyRejectsCurrentAccessAndRefreshButKeepsAnotherLogin() throws Exception {
    var first = login();
    var second = login();
    me(first).andExpect(status().isOk());
    logout(first.refreshToken(), first.response().token())
        .andExpect(status().isNoContent())
        .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
    me(first).andExpect(status().isUnauthorized());
    refresh(first.refreshToken()).andExpect(status().isUnauthorized());
    me(second).andExpect(status().isOk());
    refresh(second.refreshToken()).andExpect(status().isOk());
  }

  @Test
  void rotationPreservesSessionIdentityAndPriorAccessUntilLogout() throws Exception {
    var original = login();
    var rotated = auth.refresh(original.refreshToken(), "127.0.0.1", "JUnit");
    assertThat(jwt.parseAccessToken(original.response().token()).sessionId())
        .isEqualTo(jwt.parseAccessToken(rotated.response().token()).sessionId());
    assertThat(original.response().token()).isNotEqualTo(rotated.response().token());
    me(original).andExpect(status().isOk());
    me(rotated).andExpect(status().isOk());
    logout(rotated.refreshToken(), rotated.response().token()).andExpect(status().isNoContent());
    me(original).andExpect(status().isUnauthorized());
    me(rotated).andExpect(status().isUnauthorized());
  }

  @Test
  void staleCookieLogoutRevokesTheRotatedDescendant() throws Exception {
    var original = login();
    var rotated = auth.refresh(original.refreshToken(), "127.0.0.1", "JUnit");
    logout(original.refreshToken(), null).andExpect(status().isNoContent());
    me(original).andExpect(status().isUnauthorized());
    me(rotated).andExpect(status().isUnauthorized());
    refresh(rotated.refreshToken()).andExpect(status().isUnauthorized());
  }

  @ParameterizedTest
  @ValueSource(strings = {"missing", "unknown"})
  void bearerCanRevokeCurrentSessionWithoutAUsableCookie(String cookie) throws Exception {
    var current = login();
    logout(cookie.equals("missing") ? null : "unknown-cookie", current.response().token())
        .andExpect(status().isNoContent());
    me(current).andExpect(status().isUnauthorized());
    refresh(current.refreshToken()).andExpect(status().isUnauthorized());
  }

  @Test
  void validBearerSelectsCurrentSessionWhenCookieBelongsToAnotherLogin() throws Exception {
    var current = login();
    var other = login();
    logout(other.refreshToken(), current.response().token()).andExpect(status().isNoContent());
    me(current).andExpect(status().isUnauthorized());
    me(other).andExpect(status().isOk());
    refresh(other.refreshToken()).andExpect(status().isOk());
  }

  @Test
  void logoutRemainsIdempotentAndAcceptsExpiredAccessWithAValidCookie() throws Exception {
    var current = login();
    var id = jwt.parseAccessToken(current.response().token()).sessionId();
    String expired = signed(workspace.owner(), id.toString(), Instant.now().minusSeconds(60));
    logout(current.refreshToken(), expired).andExpect(status().isNoContent());
    logout(current.refreshToken(), current.response().token()).andExpect(status().isNoContent());
    logout(null, null).andExpect(status().isNoContent());
    logout(null, "tampered-token").andExpect(status().isNoContent());
    me(current).andExpect(status().isUnauthorized());
  }

  @ParameterizedTest
  @ValueSource(strings = {"missing", "https://untrusted.example.test"})
  void untrustedLogoutCannotRevokeOrClearTheSession(String origin) throws Exception {
    var current = login();
    var request =
        post("/api/auth/logout")
            .cookie(cookie(current.refreshToken()))
            .header("Authorization", "Bearer " + current.response().token());
    if (!origin.equals("missing")) request.header("Origin", origin);
    mvc.perform(request)
        .andExpect(status().isForbidden())
        .andExpect(header().doesNotExist("Set-Cookie"));
    me(current).andExpect(status().isOk());
  }

  @Test
  void administrativePasswordResetRevokesEveryTargetSessionImmediately() throws Exception {
    var first = login();
    var second = login();
    var admin = admin();
    String adminAuth = TestFixtures.authorization(jwt, sessions, admin);
    mvc.perform(
            patch("/api/admin/users/" + workspace.owner().getId() + "/password")
                .header("Authorization", adminAuth)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newPassword\":\"" + NEXT_PASSWORD + "\"}"))
        .andExpect(status().isNoContent());
    for (var previous : new AuthService.AuthSession[] {first, second}) {
      me(previous).andExpect(status().isUnauthorized());
      refresh(previous.refreshToken()).andExpect(status().isUnauthorized());
    }
    mvc.perform(get("/api/users/me").header("Authorization", adminAuth)).andExpect(status().isOk());
    httpLogin(PASSWORD).andExpect(status().isUnauthorized());
    httpLogin(NEXT_PASSWORD).andExpect(status().isOk());
  }

  @Test
  void ownPasswordChangeAlsoRevokesAllExistingLogins() throws Exception {
    var first = login();
    var second = login();
    mvc.perform(
            patch("/api/users/" + workspace.owner().getId() + "/password")
                .header("Authorization", "Bearer " + first.response().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"currentPassword\":\""
                        + PASSWORD
                        + "\",\"newPassword\":\""
                        + NEXT_PASSWORD
                        + "\"}"))
        .andExpect(status().isNoContent());
    me(first).andExpect(status().isUnauthorized());
    me(second).andExpect(status().isUnauthorized());
    refresh(second.refreshToken()).andExpect(status().isUnauthorized());
    httpLogin(NEXT_PASSWORD).andExpect(status().isOk());
  }

  @Test
  void rejectedPasswordChangeLeavesExistingSessionsUsable() throws Exception {
    var current = login();
    mvc.perform(
            patch("/api/users/" + workspace.owner().getId() + "/password")
                .header("Authorization", "Bearer " + current.response().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"currentPassword\":\"wrong\",\"newPassword\":\"" + NEXT_PASSWORD + "\"}"))
        .andExpect(status().isBadRequest());
    me(current).andExpect(status().isOk());
    refresh(current.refreshToken()).andExpect(status().isOk());
  }

  @Test
  void refreshReplayImmediatelyRevokesAccessForThatFamilyOnly() throws Exception {
    var original = login();
    var other = login();
    var rotated = auth.refresh(original.refreshToken(), "127.0.0.1", "JUnit");
    refresh(original.refreshToken()).andExpect(status().isUnauthorized());
    me(original).andExpect(status().isUnauthorized());
    me(rotated).andExpect(status().isUnauthorized());
    me(other).andExpect(status().isOk());
  }

  @Test
  void expiredRefreshSessionCannotAuthorizeAnUnexpiredAccessToken() throws Exception {
    var current = login();
    UUID familyId = jwt.parseAccessToken(current.response().token()).sessionId();
    transactions.executeWithoutResult(
        status ->
            tokens
                .findAllByFamilyIdAndRevokedAtIsNull(familyId)
                .forEach(token -> token.setExpiresAt(Instant.now().minusSeconds(60))));
    me(current).andExpect(status().isUnauthorized());
  }

  @ParameterizedTest
  @ValueSource(strings = {"missing", "invalid", "unknown", "other-user"})
  void sessionClaimsCannotBeOmittedInventedOrBorrowed(String claim) throws Exception {
    var current = login();
    String sid =
        switch (claim) {
          case "missing" -> null;
          case "invalid" -> "not-a-uuid";
          case "unknown" -> UUID.randomUUID().toString();
          default -> sessions.createSession(admin(), "127.0.0.1", "JUnit").familyId().toString();
        };
    String bearer = signed(workspace.owner(), sid, Instant.now().plusSeconds(600));
    mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + bearer))
        .andExpect(status().isUnauthorized());
    me(current).andExpect(status().isOk());
  }

  @Test
  void emailChangesAlsoInvalidateEveryOldSession() throws Exception {
    var current = login();
    String email = UUID.randomUUID() + "@example.test";
    mvc.perform(
            patch("/api/users/me/email")
                .header("Authorization", "Bearer " + current.response().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"currentPassword\":\"" + PASSWORD + "\",\"newEmail\":\"" + email + "\"}"))
        .andExpect(status().isNoContent());
    me(current).andExpect(status().isUnauthorized());
    refresh(current.refreshToken()).andExpect(status().isUnauthorized());
    var next = auth.login(new LoginRequest(email, PASSWORD), "127.0.0.1", "JUnit");
    me(next).andExpect(status().isOk());
  }

  @Test
  void httpLoginAndRegisterIssueBoundAccessTokensAndHttpOnlyCookies() throws Exception {
    httpLogin(PASSWORD)
        .andExpect(status().isOk())
        .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
        .andExpect(header().string("Cache-Control", "no-store"));
    String email = UUID.randomUUID() + "@example.test";
    var result =
        mvc.perform(
                post("/api/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"email\":\""
                            + email
                            + "\",\"firstName\":\"New\",\"lastName\":\"User\",\"password\":\""
                            + PASSWORD
                            + "\",\"confirmPassword\":\""
                            + PASSWORD
                            + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(header().string("Set-Cookie", containsString("HttpOnly")))
            .andReturn();
    String access = JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    var claims = jwt.parseAccessToken(access);
    assertThat(sessions.isSessionActive(claims.sessionId(), claims.userId())).isTrue();
    mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + access))
        .andExpect(status().isOk());
  }

  @Test
  void loginAndResetSerializeSoOnlyTheNewPasswordCanIssueASessionAfterReset() throws Exception {
    var admin = admin();
    var administrator =
        new UsernamePasswordAuthenticationToken(
            new CustomUserPrincipal(admin), null, new CustomUserPrincipal(admin).getAuthorities());
    CountDownLatch changed = new CountDownLatch(1), release = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var reset =
          executor.submit(
              () -> {
                SecurityContextHolder.getContext().setAuthentication(administrator);
                try {
                  transactions.executeWithoutResult(
                      status -> {
                        users.resetPasswordByAdmin(
                            workspace.owner().getId(),
                            new AdminResetPasswordRequest(NEXT_PASSWORD),
                            admin.getEmail());
                        em.flush();
                        changed.countDown();
                        await(release);
                      });
                } finally {
                  SecurityContextHolder.clearContext();
                }
              });
      assertThat(changed.await(10, TimeUnit.SECONDS)).isTrue();
      CountDownLatch attempted = new CountDownLatch(1);
      var login =
          executor.submit(
              () -> {
                attempted.countDown();
                return auth.login(
                    new LoginRequest(workspace.owner().getEmail(), PASSWORD), "127.0.0.1", "JUnit");
              });
      assertThat(attempted.await(5, TimeUnit.SECONDS)).isTrue();
      // The reset owns the row lock. A credential check must not complete on the old committed
      // hash.
      assertThatThrownBy(() -> login.get(250, TimeUnit.MILLISECONDS))
          .isInstanceOf(TimeoutException.class);
      release.countDown();
      reset.get(15, TimeUnit.SECONDS);
      assertThatThrownBy(() -> login.get(15, TimeUnit.SECONDS))
          .hasCauseInstanceOf(AuthException.class);
      httpLogin(NEXT_PASSWORD).andExpect(status().isOk());
    } finally {
      release.countDown();
    }
  }

  @Test
  void logoutRacingWithRotationLeavesNoUsableSession() throws Exception {
    var original = login();
    var separate = login();
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var logout =
          executor.submit(
              () -> {
                await(start);
                auth.logout(original.refreshToken(), original.response().token());
              });
      var refresh =
          executor.submit(
              () -> {
                await(start);
                try {
                  return auth.refresh(original.refreshToken(), "127.0.0.1", "JUnit");
                } catch (BadCredentialsException ex) {
                  return null;
                }
              });
      start.countDown();
      logout.get(15, TimeUnit.SECONDS);
      var rotated = refresh.get(15, TimeUnit.SECONDS);
      me(original).andExpect(status().isUnauthorized());
      if (rotated != null) {
        me(rotated).andExpect(status().isUnauthorized());
        refresh(rotated.refreshToken()).andExpect(status().isUnauthorized());
      }
      me(separate).andExpect(status().isOk());
    } finally {
      start.countDown();
    }
  }

  private AuthService.AuthSession login() {
    return auth.login(
        new LoginRequest(workspace.owner().getEmail(), PASSWORD), "127.0.0.1", "JUnit");
  }

  private ResultActions httpLogin(String password) throws Exception {
    return mvc.perform(
        post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"email\":\""
                    + workspace.owner().getEmail()
                    + "\",\"password\":\""
                    + password
                    + "\"}"));
  }

  private ResultActions me(AuthService.AuthSession session) throws Exception {
    return mvc.perform(
        get("/api/users/me").header("Authorization", "Bearer " + session.response().token()));
  }

  private Cookie cookie(String raw) {
    return new Cookie("refresh_token", raw);
  }

  private ResultActions refresh(String raw) throws Exception {
    return mvc.perform(post("/api/auth/refresh").header("Origin", ORIGIN).cookie(cookie(raw)));
  }

  private ResultActions logout(String raw, String bearer) throws Exception {
    var request = post("/api/auth/logout").header("Origin", ORIGIN);
    if (raw != null) request.cookie(cookie(raw));
    if (bearer != null) request.header("Authorization", "Bearer " + bearer);
    return mvc.perform(request);
  }

  private UserEntity admin() {
    return transactions.execute(
        status -> {
          var user = new UserEntity();
          user.setEmail(UUID.randomUUID() + "@example.test");
          user.setFirstName("Admin");
          user.setLastName("User");
          user.setRole(UserRole.ADMIN);
          user.setPassword("unused");
          em.persist(user);
          return user;
        });
  }

  private String signed(UserEntity user, String sessionId, Instant expires) {
    var builder =
        Jwts.builder()
            .subject(user.getEmail())
            .issuer("team-task-manager-tests")
            .claim("userId", user.getId().toString())
            .expiration(Date.from(expires));
    if (sessionId != null) builder.claim("sid", sessionId);
    return builder
        .signWith(
            Keys.hmacShaKeyFor(
                "phase-one-test-only-secret-at-least-thirty-two-bytes-long"
                    .getBytes(StandardCharsets.UTF_8)))
        .compact();
  }

  private void await(CountDownLatch latch) {
    try {
      if (!latch.await(10, TimeUnit.SECONDS))
        throw new IllegalStateException("Session race timed out");
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(ex);
    }
  }
}
