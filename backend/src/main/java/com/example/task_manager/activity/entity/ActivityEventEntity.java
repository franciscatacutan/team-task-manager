package com.example.task_manager.activity.entity;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
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
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Unified activity event for task, project, and team history. */
@Getter
@Setter
@Entity
@Table(
    name = "activity_events",
    indexes = {
      @Index(name = "idx_activity_team_created_at", columnList = "team_id, created_at"),
      @Index(name = "idx_activity_project_created_at", columnList = "project_id, created_at"),
      @Index(name = "idx_activity_task_created_at", columnList = "task_id, created_at"),
      @Index(
          name = "idx_activity_entity_created_at",
          columnList = "entity_type, entity_id, created_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class ActivityEventEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "team_id", nullable = false)
  private UUID teamId;

  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "task_id")
  private UUID taskId;

  @Enumerated(EnumType.STRING)
  @Column(name = "entity_type", nullable = false, length = 50)
  private ActivityEntityType entityType;

  @Column(name = "entity_id", nullable = false)
  private UUID entityId;

  @Enumerated(EnumType.STRING)
  @Column(name = "parent_entity_type", length = 50)
  private ActivityEntityType parentEntityType;

  @Column(name = "parent_entity_id")
  private UUID parentEntityId;

  @Enumerated(EnumType.STRING)
  @Column(name = "event_type", nullable = false, length = 80)
  private ActivityEventType eventType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "details_json", nullable = false, columnDefinition = "jsonb")
  private ActivityEventDetails details;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String message;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false)
  private UserEntity user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "task_id", insertable = false, updatable = false)
  private TaskEntity task;

  @CreatedDate
  @Column(nullable = false, updatable = false)
  private Instant createdAt;
}
