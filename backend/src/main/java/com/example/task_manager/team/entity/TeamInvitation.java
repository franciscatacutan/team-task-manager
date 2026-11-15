package com.example.task_manager.team.entity;

import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "team_invitations")
public class TeamInvitation {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "team_id", nullable = false)
  private TeamEntity team;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "inviter_id", nullable = false)
  private UserEntity inviter;

  @Column(nullable = false, length = 150)
  private String email;

  @Column(nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(nullable = false)
  private Instant expiresAt;

  private Instant consumedAt;
}
