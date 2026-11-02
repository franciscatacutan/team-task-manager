package com.example.task_manager.observability.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/** KPI snapshot table for period-based business metrics. */
@Getter
@Setter
@Entity
@Table(
    name = "kpi_snapshots",
    indexes = {
      @Index(
          name = "idx_kpi_scope_period",
          columnList = "scope, scope_id, period_start, period_end"),
      @Index(name = "idx_kpi_key_period", columnList = "kpi_key, period_start, period_end")
    })
public class KpiSnapshotEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "kpi_key", nullable = false, length = 120)
  private String kpiKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private MetricScope scope;

  @Column(name = "scope_id")
  private UUID scopeId;

  @Column(name = "period_start", nullable = false)
  private Instant periodStart;

  @Column(name = "period_end", nullable = false)
  private Instant periodEnd;

  @Column(nullable = false, precision = 19, scale = 4)
  private BigDecimal value;

  @Column(precision = 19, scale = 4)
  private BigDecimal target;

  @Column(length = 40)
  private String unit;
}
