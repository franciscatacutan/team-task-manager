package com.example.task_manager.config.jwt;

import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.user.entity.UserEntity;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Objects;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

/** Service for handling JWT operations. */
@Service
public class JwtService implements InitializingBean {

  @Value("${auth.jwt.secret}")
  private String secret;

  @Value("${auth.jwt.issuer}")
  private String issuer;

  @Value("${auth.access-token-expiration-ms}")
  private long accessTokenExpirationMs;

  /** Generates a JWT token for the given user. */
  public String generateToken(UserEntity user, UUID sessionId) {
    Instant now = Instant.now();

    return Jwts.builder()
        .subject(user.getEmail())
        .id(UUID.randomUUID().toString())
        .issuer(issuer)
        .claim("role", user.getRole().name())
        .claim("userId", user.getId())
        .claim("sid", Objects.requireNonNull(sessionId).toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plusMillis(accessTokenExpirationMs)))
        .signWith(getKey())
        .compact();
  }

  public long getAccessTokenExpirationSeconds() {
    return accessTokenExpirationMs / 1000;
  }

  /** Validates the signature, issuer, expiry and mandatory identity/session claims once. */
  public AccessTokenClaims parseAccessToken(String token) {
    Claims claims = getClaims(token);
    if (claims.getExpiration() == null
        || !claims.getExpiration().after(new Date())
        || claims.getSubject() == null
        || claims.getSubject().isBlank()) {
      throw new MalformedJwtException("Access token requires an expiry and subject");
    }
    try {
      return new AccessTokenClaims(
          claims.getSubject(),
          UUID.fromString(claims.get("userId", String.class)),
          UUID.fromString(claims.get("sid", String.class)));
    } catch (IllegalArgumentException | NullPointerException ex) {
      throw new MalformedJwtException(
          "Access token requires valid user and session identities", ex);
    }
  }

  public String extractEmail(String token) {
    return parseAccessToken(token).email();
  }

  /** Cryptographic/identity validation. The filter separately checks active session state. */
  public boolean isTokenValid(String token, UserDetails userDetails) {
    return parseAccessToken(token).matches(userDetails);
  }

  public record AccessTokenClaims(String email, UUID userId, UUID sessionId) {
    public boolean matches(UserDetails details) {
      return details instanceof CustomUserPrincipal principal
          && userId.equals(principal.getId())
          && email.equalsIgnoreCase(principal.getUsername());
    }
  }

  /** Extracts claims from a JWT token. */
  private Claims getClaims(String token) {
    return Jwts.parser()
        .verifyWith(getKey())
        .requireIssuer(issuer)
        .build()
        .parseSignedClaims(token)
        .getPayload();
  }

  /** Gets the signing key for JWT operations. */
  private SecretKey getKey() {
    return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
  }

  @Override
  public void afterPropertiesSet() {
    if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
      throw new IllegalStateException("JWT secret must be at least 32 bytes long");
    }
    if (issuer == null || issuer.isBlank()) {
      throw new IllegalStateException("JWT issuer must be configured");
    }
    if (accessTokenExpirationMs <= 0) {
      throw new IllegalStateException("Access-token expiration must be positive");
    }
  }
}
