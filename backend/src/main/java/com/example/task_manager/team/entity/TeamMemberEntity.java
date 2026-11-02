package com.example.task_manager.team.entity;

import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Entity representing a team member. */
@Entity
@Table(
    name = "team_members",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_teamMember_team_user",
          columnNames = {"team_id", "user_id"})
    },
    indexes = {@Index(name = "idx_teamMember_team", columnList = "team_id")})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  // Many-to-one relationship with team (team)
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "team_id", nullable = false)
  private TeamEntity team;

  // Many-to-one relationship with user (member)
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserEntity user;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TeamRole role;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "added_by", nullable = false)
  private UserEntity addedBy;

  @CreationTimestamp private Instant joinedAt;

  @Version private Long version;
}
