package com.example.task_manager.config.jwt;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.user.entity.UserEntity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Service for handling JWT operations.
 */
@Service
public class JwtService implements InitializingBean {

  @Value("${auth.jwt.secret}")
  private String secret;

  @Value("${auth.jwt.issuer}")
  private String issuer;

  @Value("${auth.access-token-expiration-ms}")
  private long accessTokenExpirationMs;

  /**
   * Generates a JWT token for the given user.
   */
  public String generateToken(UserEntity user) {
    Instant now = Instant.now();

    return Jwts.builder()
        .setSubject(user.getEmail())
        .setId(user.getId().toString())
        .setIssuer(issuer)
        .claim("role", user.getRole().name())
        .claim("userId", user.getId())
        .setIssuedAt(Date.from(now))
        .setExpiration(Date.from(now.plusMillis(accessTokenExpirationMs)))
        .signWith(getKey())
        .compact();
  }

  public long getAccessTokenExpirationSeconds() {
    return accessTokenExpirationMs / 1000;
  }

  /**
   * Extracts the email from a JWT token.
   */
  public String extractEmail(String token) {
    return getClaims(token).getSubject();
  }

  /**
   * Validates a JWT token.
   */
  public boolean isTokenValid(String token, UserDetails userDetails) {
    Claims claims = getClaims(token);
    if (isTokenExpired(claims)) {
      return false;
    }

    if (!issuer.equals(claims.getIssuer())) {
      return false;
    }

    if (!claims.getSubject().equalsIgnoreCase(userDetails.getUsername())) {
      return false;
    }

    if (userDetails instanceof CustomUserPrincipal principal) {
      String tokenUserId = claims.get("userId", String.class);
      return principal.getId().equals(UUID.fromString(tokenUserId));
    }

    return true;
  }

  private boolean isTokenExpired(Claims claims) {
    return claims.getExpiration().before(new Date());
  }

  /**
   * Extracts claims from a JWT token.
   */
  private Claims getClaims(String token) {
    return Jwts.parserBuilder()
        .setSigningKey(getKey())
        .requireIssuer(issuer)
        .build()
        .parseClaimsJws(token)
        .getBody();
  }

  /**
   * Gets the signing key for JWT operations.
   */
  private Key getKey() {
    return Keys.hmacShaKeyFor(
        secret.getBytes(StandardCharsets.UTF_8));
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
