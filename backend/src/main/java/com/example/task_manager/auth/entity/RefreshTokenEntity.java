package com.example.task_manager.auth.entity;

import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** Persisted refresh token session used for rotation and revocation. */
@Getter
@Setter
@Entity
@Table(name = "refresh_tokens")
public class RefreshTokenEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserEntity user;

  @Column(nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(nullable = false, updatable = false)
  private UUID familyId;

  @Column(length = 64)
  private String replacedByTokenHash;

  @Column(nullable = false)
  private Instant expiresAt;

  @Column private Instant revokedAt;

  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @Column private Instant lastUsedAt;

  @Column(length = 64)
  private String createdByIp;

  @Column(length = 512)
  private String userAgent;

  public boolean isExpired() {
    return expiresAt.isBefore(Instant.now());
  }

  public boolean isRevoked() {
    return revokedAt != null;
  }
}
