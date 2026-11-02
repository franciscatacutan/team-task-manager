package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.*;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.transaction.support.TransactionTemplate;

import com.example.task_manager.auth.entity.RefreshTokenEntity;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;

import jakarta.persistence.EntityManager;

class RefreshTokenIntegrationTest extends PostgresIntegrationTest {
  @Autowired AuthService auth;
  @Autowired RefreshTokenService tokens;
  @Autowired RefreshTokenRepository repository;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  private Workspace workspace;

  @BeforeEach
  void setUp() {
    workspace = transactions.execute(status -> TestFixtures.workspace(em));
  }

  @Test
  void rotatesOnceAndCommitsFamilyRevocationWhenAnAncestorIsReused() {
    String original = issue();
    String successor = refresh(original);
    String separateSession = issue();
    assertThat(activeTokens()).hasSize(2);
    assertThatThrownBy(() -> refresh(original)).isInstanceOf(BadCredentialsException.class);
    assertThat(activeTokens()).hasSize(1);
    assertThatThrownBy(() -> refresh(successor)).isInstanceOf(BadCredentialsException.class);
    assertThat(refresh(separateSession)).isNotBlank();
  }

  @Test
  void commitsExpiryRevocationEvenThoughRefreshFails() {
    String original = issue();
    transactions.executeWithoutResult(status -> {
      RefreshTokenEntity token = repository.findAllByUser_IdAndRevokedAtIsNull(workspace.owner().getId()).getFirst();
      token.setExpiresAt(Instant.now().minusSeconds(60));
    });
    assertThatThrownBy(() -> refresh(original)).isInstanceOf(BadCredentialsException.class);
    assertThat(activeTokens()).isEmpty();
  }

  @Test
  void simultaneousRefreshesCannotForkTheTokenFamily() throws Exception {
    String original = issue();
    List<Boolean> successes = race(original, original);
    assertThat(successes).containsExactlyInAnyOrder(true, false);
    // The second use is a replay: the newly issued successor must also be revoked.
    assertThat(activeTokens()).isEmpty();
  }

  @Test
  void ancestorReuseRacingWithDescendantRotationLeavesNoValidFamilyTokens() throws Exception {
    String ancestor = issue();
    String descendant = refresh(ancestor);
    race(ancestor, descendant);
    assertThat(activeTokens()).isEmpty();
  }

  @Test
  void unrelatedFailuresStillRollBackRotation() {
    String original = issue();
    assertThatThrownBy(() -> transactions.executeWithoutResult(status -> {
      tokens.rotate(original, "127.0.0.1", "JUnit");
      throw new IllegalStateException("Simulated failure after rotation");
    })).isInstanceOf(IllegalStateException.class);
    assertThat(activeTokens()).hasSize(1);
    assertThat(refresh(original)).isNotBlank();
  }

  @Test
  void logoutRevokesTheSession() {
    String original = issue();
    auth.logout(original);
    assertThatThrownBy(() -> refresh(original)).isInstanceOf(BadCredentialsException.class);
    assertThat(activeTokens()).isEmpty();
  }

  private String issue() {
    return tokens.createSession(workspace.owner(), "127.0.0.1", "JUnit").token();
  }

  private String refresh(String token) {
    return auth.refresh(token, "127.0.0.1", "JUnit").refreshToken();
  }

  private List<RefreshTokenEntity> activeTokens() {
    return repository.findAllByUser_IdAndRevokedAtIsNull(workspace.owner().getId());
  }

  private List<Boolean> race(String first, String second) throws Exception {
    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    try (var executor = Executors.newFixedThreadPool(2)) {
      var a = executor.submit(attempt(first, ready, start));
      var b = executor.submit(attempt(second, ready, start));
      assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
      start.countDown();
      return List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS));
    } finally {
      start.countDown();
    }
  }

  private Callable<Boolean> attempt(String token, CountDownLatch ready, CountDownLatch start) {
    return () -> {
      ready.countDown();
      if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Refresh race timed out");
      try {
        refresh(token);
        return true;
      } catch (BadCredentialsException ex) {
        return false;
      }
    };
  }
}
