package com.example.task_manager.task.entity;

import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Entity representing a task. */
@Getter
@Setter
@Entity
@Table(
    name = "tasks",
    uniqueConstraints = {
      @UniqueConstraint(
          name = "uk_task_project_number",
          columnNames = {"project_id", "task_number"})
    },
    indexes = {
      @Index(name = "idx_task_project_deleted", columnList = "project_id, deleted_at"),
      @Index(name = "idx_task_assignee_deleted", columnList = "assignee_id, deleted_at"),
      @Index(name = "idx_task_team_status_due", columnList = "status, planned_due_date, deleted_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class TaskEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(length = 2000)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TaskStatus status = TaskStatus.TODO;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private TaskPriority priority;

  @Column(nullable = false)
  private Long taskNumber;

  private Instant plannedStartDate;

  private Instant plannedDueDate;

  private Instant actualStartDate;

  private Instant actualCompletionDate;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "project_id", nullable = false)
  private ProjectEntity project;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "assignee_id", nullable = false)
  private UserEntity assignee;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "support_id")
  private UserEntity support;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private UserEntity createdBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "completed_by")
  private UserEntity completedBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "deleted_by")
  private UserEntity deletedBy;

  @CreatedDate
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(nullable = false)
  private Instant updatedAt;

  private Instant lastActivityAt;

  private Instant statusChangedAt;

  private Instant deletedAt;

  @Version private Long version;
}
