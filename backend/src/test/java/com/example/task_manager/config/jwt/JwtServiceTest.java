package com.example.task_manager.config.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.IncorrectClaimException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

class JwtServiceTest {
  private static final String SECRET = "test-only-signing-key-at-least-thirty-two-bytes-long";
  private static final String ISSUER = "team-task-manager-tests";
  private JwtService service;
  private UserEntity user;

  @BeforeEach
  void setUp() {
    service = new JwtService();
    ReflectionTestUtils.setField(service, "secret", SECRET);
    ReflectionTestUtils.setField(service, "issuer", ISSUER);
    ReflectionTestUtils.setField(service, "accessTokenExpirationMs", 900_000L);
    service.afterPropertiesSet();
    user = new UserEntity();
    user.setId(UUID.randomUUID());
    user.setEmail("user@example.test");
    user.setPassword("not-used");
    user.setRole(UserRole.USER);
  }

  @Test
  void generatedTokenAuthenticatesItsUserAndKeepsTheExistingClaims() {
    UUID sessionId = UUID.randomUUID();
    String token = service.generateToken(user, sessionId);
    assertThat(service.extractEmail(token)).isEqualTo(user.getEmail());
    assertThat(service.isTokenValid(token, new CustomUserPrincipal(user))).isTrue();
    var claims =
        Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    assertThat(UUID.fromString(claims.getId())).isNotNull();
    assertThat(UUID.fromString(claims.get("sid", String.class))).isEqualTo(sessionId);
    assertThat(claims.get("userId", String.class)).isEqualTo(user.getId().toString());
    assertThat(claims.get("role", String.class)).isEqualTo("USER");
    assertThat(service.getAccessTokenExpirationSeconds()).isEqualTo(900);
  }

  @Test
  void rejectsTokensForAnotherUserEvenWhenTheEmailMatches() {
    String token = service.generateToken(user, UUID.randomUUID());
    user.setId(UUID.randomUUID());
    assertThat(service.isTokenValid(token, new CustomUserPrincipal(user))).isFalse();
  }

  @Test
  void rejectsTokensForAnotherEmail() {
    String token = service.generateToken(user, UUID.randomUUID());
    user.setEmail("other@example.test");
    assertThat(service.isTokenValid(token, new CustomUserPrincipal(user))).isFalse();
  }

  @Test
  void rejectsTokensSignedWithAnotherKey() {
    String token =
        signedToken(
            "another-test-only-key-at-least-thirty-two-bytes-long",
            ISSUER,
            Instant.now().plusSeconds(60));
    assertThatThrownBy(() -> service.extractEmail(token)).isInstanceOf(SignatureException.class);
  }

  @Test
  void rejectsTokensFromAnotherIssuer() {
    String token = signedToken(SECRET, "another-issuer", Instant.now().plusSeconds(60));
    assertThatThrownBy(() -> service.extractEmail(token))
        .isInstanceOf(IncorrectClaimException.class);
  }

  @Test
  void rejectsExpiredTokens() {
    String token = signedToken(SECRET, ISSUER, Instant.now().minusSeconds(60));
    assertThatThrownBy(() -> service.extractEmail(token)).isInstanceOf(ExpiredJwtException.class);
  }

  @ParameterizedTest
  @ValueSource(strings = {"expiry", "subject", "userId"})
  void rejectsMissingRequiredClaims(String missing) {
    var builder = Jwts.builder().issuer(ISSUER).claim("sid", UUID.randomUUID().toString());
    if (!missing.equals("expiry")) builder.expiration(Date.from(Instant.now().plusSeconds(60)));
    if (!missing.equals("subject")) builder.subject(user.getEmail());
    if (!missing.equals("userId")) builder.claim("userId", user.getId().toString());
    String token =
        builder.signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
    assertThatThrownBy(() -> service.parseAccessToken(token))
        .isInstanceOf(MalformedJwtException.class);
  }

  private String signedToken(String secret, String issuer, Instant expiresAt) {
    return Jwts.builder()
        .subject(user.getEmail())
        .issuer(issuer)
        .expiration(Date.from(expiresAt))
        .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
        .compact();
  }
}
