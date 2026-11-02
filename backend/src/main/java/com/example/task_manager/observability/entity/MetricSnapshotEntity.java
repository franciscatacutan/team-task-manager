package com.example.task_manager.observability.entity;

import com.example.task_manager.activity.dto.ActivityEventDetails;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Time-series metric snapshot for dashboarding and trend analysis. */
@Getter
@Setter
@Entity
@Table(
    name = "metric_snapshots",
    indexes = {
      @Index(name = "idx_metric_scope_recorded_at", columnList = "scope, scope_id, recorded_at"),
      @Index(name = "idx_metric_key_recorded_at", columnList = "metric_key, recorded_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class MetricSnapshotEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "metric_key", nullable = false, length = 120)
  private String metricKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private MetricScope scope;

  @Column(name = "scope_id")
  private UUID scopeId;

  @Column(nullable = false, precision = 19, scale = 4)
  private BigDecimal value;

  @Column(length = 40)
  private String unit;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "dimensions_json", columnDefinition = "jsonb")
  private ActivityEventDetails dimensions;

  @CreatedDate
  @Column(name = "recorded_at", nullable = false, updatable = false)
  private Instant recordedAt;
}
