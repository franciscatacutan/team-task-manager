package com.example.task_manager.team.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.example.task_manager.user.entity.UserEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

/**
 * Entity representing a team.
 */
@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class) // Enable auditing for createdAt and updatedAt fields
@Table(name = "teams", uniqueConstraints = {
    @UniqueConstraint(name = "uk_team_key", columnNames = "team_key") }, indexes = {
        @Index(name = "idx_team_owner_id_deleted", columnList = "owner_id, deleted_at"),
        @Index(name = "idx_team_name", columnList = "name"),
        @Index(name = "idx_team_deleted", columnList = "deleted_at")
    })
public class TeamEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 2000)
  private String description;

  @Column(name = "team_key", nullable = false, unique = true, length = 50)
  private String key;

  // Many-to-one relationship with user (owner)
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private UserEntity owner;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private UserEntity createdBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "deleted_by")
  private UserEntity deletedBy;

  // One-to-many relationship with user (members)
  @OneToMany(mappedBy = "team", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<TeamMemberEntity> members = new ArrayList<>();

  @CreationTimestamp
  private Instant createdAt;

  @LastModifiedDate
  private Instant updatedAt;

  private Instant lastActivityAt;

  private Instant ownerChangedAt;

  private Instant membershipChangedAt;

  private Instant deletedAt;

  @Version
  private Long version;
}
