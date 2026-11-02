package com.example.task_manager.observability.entity;

import com.example.task_manager.activity.dto.ActivityEntityType;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
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

/** Immutable audit record derived from domain activity. */
@Getter
@Setter
@Entity
@Table(
    name = "audit_logs",
    indexes = {
      @Index(name = "idx_audit_team_occurred_at", columnList = "team_id, occurred_at"),
      @Index(
          name = "idx_audit_entity_occurred_at",
          columnList = "entity_type, entity_id, occurred_at"),
      @Index(name = "idx_audit_actor_occurred_at", columnList = "actor_id, occurred_at"),
      @Index(name = "idx_audit_action_occurred_at", columnList = "action, occurred_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class AuditLogEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "team_id")
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
  @Column(nullable = false, length = 50)
  private AuditAction action;

  @Enumerated(EnumType.STRING)
  @Column(name = "event_type", nullable = false, length = 80)
  private ActivityEventType eventType;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "actor_id", nullable = false)
  private UserEntity actor;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String summary;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "metadata_json", nullable = false, columnDefinition = "jsonb")
  private ActivityEventDetails metadata;

  @CreatedDate
  @Column(name = "occurred_at", nullable = false, updatable = false)
  private Instant occurredAt;
}
