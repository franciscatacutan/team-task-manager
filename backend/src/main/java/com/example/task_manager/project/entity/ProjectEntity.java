package com.example.task_manager.project.entity;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.user.entity.UserEntity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Entity representing a project.
 */
@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class) // Enable auditing for createdAt and updatedAt fields
@Table(name = "projects", uniqueConstraints = {
    @UniqueConstraint(name = "uk_project_key", columnNames = "project_key") }, indexes = {
        @Index(name = "idx_project_team_deleted", columnList = "team_id, deleted_at"),
        @Index(name = "idx_project_team_name", columnList = "team_id, name"),
        @Index(name = "idx_project_team_status_due", columnList = "team_id, status, planned_due_date, deleted_at")
    })
public class ProjectEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 2000)
  private String description;

  @Column(name = "project_key", nullable = false, unique = true, length = 50)
  private String key;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private ProjectStatus status = ProjectStatus.ACTIVE;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "team_id", nullable = false)
  private TeamEntity team;

  // Many-to-one relationship with user (owner)
  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "owner_id", nullable = false)
  private UserEntity owner;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private UserEntity createdBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "completed_by")
  private UserEntity completedBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "deleted_by")
  private UserEntity deletedBy;

  @Column(name = "next_task_number", nullable = false)
  private Long nextTaskNumber = 1L;

  private Instant plannedStartDate;

  private Instant plannedDueDate;

  private Instant actualStartDate;

  private Instant actualCompletionDate;

  @CreatedDate
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(nullable = false)
  private Instant updatedAt;

  private Instant lastActivityAt;

  private Instant statusChangedAt;

  private Instant deletedAt;

  @Version
  private Long version;
}
