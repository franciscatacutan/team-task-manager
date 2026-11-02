package com.example.task_manager.observability.entity;

import com.example.task_manager.activity.dto.ActivityEventDetails;
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

/** Operational event stream for monitoring important system/domain moments. */
@Getter
@Setter
@Entity
@Table(
    name = "system_events",
    indexes = {
      @Index(name = "idx_system_event_team_occurred_at", columnList = "team_id, occurred_at"),
      @Index(name = "idx_system_event_name_occurred_at", columnList = "event_name, occurred_at"),
      @Index(name = "idx_system_event_severity_occurred_at", columnList = "severity, occurred_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class SystemEventEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private SystemEventSeverity severity = SystemEventSeverity.INFO;

  @Column(nullable = false, length = 80)
  private String category;

  @Column(name = "event_name", nullable = false, length = 100)
  private String eventName;

  @Column(nullable = false, length = 120)
  private String source;

  @Column(name = "team_id")
  private UUID teamId;

  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "task_id")
  private UUID taskId;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String message;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "actor_id")
  private UserEntity actor;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "context_json", columnDefinition = "jsonb")
  private ActivityEventDetails context;

  @CreatedDate
  @Column(name = "occurred_at", nullable = false, updatable = false)
  private Instant occurredAt;
}
