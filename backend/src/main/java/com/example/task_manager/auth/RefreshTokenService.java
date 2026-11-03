package com.example.task_manager.auth;

import com.example.task_manager.auth.entity.RefreshTokenEntity;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Handles refresh token issuance, rotation, reuse detection and revocation. */
@Service
public class RefreshTokenService {

  private final RefreshTokenRepository refreshTokenRepository;
  private final UserRepository userRepository;
  private final long refreshTokenExpirationMs;

  public RefreshTokenService(
      RefreshTokenRepository refreshTokenRepository,
      UserRepository userRepository,
      @Value("${auth.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.userRepository = userRepository;
    this.refreshTokenExpirationMs = refreshTokenExpirationMs;
  }

  @Transactional
  public RefreshTokenSession createSession(UserEntity user, String ipAddress, String userAgent) {
    lockUser(user.getId());
    String rawToken = generateRefreshToken();
    RefreshTokenEntity refreshToken = new RefreshTokenEntity();
    refreshToken.setUser(user);
    refreshToken.setTokenHash(hashToken(rawToken));
    refreshToken.setFamilyId(UUID.randomUUID());
    refreshToken.setCreatedAt(Instant.now());
    refreshToken.setLastUsedAt(refreshToken.getCreatedAt());
    refreshToken.setExpiresAt(refreshToken.getCreatedAt().plusMillis(refreshTokenExpirationMs));
    refreshToken.setCreatedByIp(truncate(ipAddress, 64));
    refreshToken.setUserAgent(truncate(userAgent, 512));
    refreshTokenRepository.save(refreshToken);
    return new RefreshTokenSession(
        rawToken, refreshToken.getExpiresAt(), refreshToken.getFamilyId());
  }

  // Rejection must commit reuse/expiry revocations. The outer auth transaction
  // uses the same rule; unrelated failures still roll back token issuance.
  @Transactional(noRollbackFor = BadCredentialsException.class)
  public RefreshTokenSession rotate(String rawToken, String ipAddress, String userAgent) {
    String tokenHash = hashToken(rawToken);
    UUID userId =
        refreshTokenRepository
            .findUserIdByTokenHash(tokenHash)
            .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));
    // Serialize the whole user's token family, including ancestor reuse racing
    // with a descendant rotation. Load token state only after acquiring the lock.
    lockUser(userId);
    RefreshTokenEntity currentToken =
        refreshTokenRepository
            .findByTokenHash(tokenHash)
            .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));

    if (currentToken.isRevoked()) {
      revokeFamily(currentToken.getFamilyId());
      throw new BadCredentialsException("Refresh token reuse detected");
    }

    if (currentToken.isExpired()) {
      currentToken.setRevokedAt(Instant.now());
      throw new BadCredentialsException("Refresh token has expired");
    }

    currentToken.setLastUsedAt(Instant.now());

    String nextRawToken = generateRefreshToken();
    String nextTokenHash = hashToken(nextRawToken);

    currentToken.setRevokedAt(Instant.now());
    currentToken.setReplacedByTokenHash(nextTokenHash);

    RefreshTokenEntity nextToken = new RefreshTokenEntity();
    nextToken.setUser(currentToken.getUser());
    nextToken.setTokenHash(nextTokenHash);
    nextToken.setFamilyId(currentToken.getFamilyId());
    nextToken.setCreatedAt(Instant.now());
    nextToken.setLastUsedAt(nextToken.getCreatedAt());
    nextToken.setExpiresAt(nextToken.getCreatedAt().plusMillis(refreshTokenExpirationMs));
    nextToken.setCreatedByIp(truncate(ipAddress, 64));
    nextToken.setUserAgent(truncate(userAgent, 512));
    refreshTokenRepository.save(nextToken);

    return new RefreshTokenSession(nextRawToken, nextToken.getExpiresAt(), nextToken.getFamilyId());
  }

  /** A cookie may refer to an already rotated token; revoke its entire login session. */
  @Transactional
  public boolean revoke(String rawToken) {
    if (rawToken == null || rawToken.isBlank()) return false;
    String tokenHash = hashToken(rawToken);
    var userId = refreshTokenRepository.findUserIdByTokenHash(tokenHash);
    if (userId.isEmpty()) return false;
    lockUser(userId.get());
    var token = refreshTokenRepository.findByTokenHash(tokenHash);
    if (token.isEmpty()) return false;
    revokeFamily(token.get().getFamilyId());
    return true;
  }

  /** Revoke only the login identified by the signed access token, with user binding. */
  @Transactional
  public void revokeSession(UUID familyId, UUID userId) {
    if (!refreshTokenRepository.existsByFamilyIdAndUser_Id(familyId, userId)) return;
    lockUser(userId);
    revokeFamily(familyId);
  }

  /** No cache: revocation is visible on the next protected request after commit. */
  @Transactional(readOnly = true)
  public boolean isSessionActive(UUID familyId, UUID userId) {
    return refreshTokenRepository.existsByFamilyIdAndUser_IdAndRevokedAtIsNullAndExpiresAtAfter(
        familyId, userId, Instant.now());
  }

  @Transactional
  public void revokeAllForUser(UUID userId) {
    lockUser(userId);
    List<RefreshTokenEntity> tokens =
        refreshTokenRepository.findAllByUser_IdAndRevokedAtIsNull(userId);
    Instant now = Instant.now();
    tokens.forEach(token -> token.setRevokedAt(now));
  }

  @Transactional(readOnly = true)
  public UserEntity getUserForRefreshToken(String rawToken) {
    RefreshTokenEntity token =
        refreshTokenRepository
            .findByTokenHash(hashToken(rawToken))
            .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));

    if (token.isRevoked() || token.isExpired()) {
      throw new BadCredentialsException("Refresh token is invalid");
    }

    return token.getUser();
  }

  private void lockUser(UUID userId) {
    userRepository
        .findByIdForUpdate(userId)
        .orElseThrow(() -> new BadCredentialsException("Refresh token is invalid"));
  }

  private void revokeFamily(UUID familyId) {
    Instant now = Instant.now();
    refreshTokenRepository
        .findAllByFamilyIdAndRevokedAtIsNull(familyId)
        .forEach(token -> token.setRevokedAt(now));
  }

  private String generateRefreshToken() {
    byte[] randomBytes = new byte[64];
    new java.security.SecureRandom().nextBytes(randomBytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
  }

  private String hashToken(String rawToken) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 is unavailable", ex);
    }
  }

  private String truncate(String value, int maxLength) {
    if (value == null) {
      return null;
    }
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }

  public record RefreshTokenSession(String token, Instant expiresAt, UUID familyId) {}
}
