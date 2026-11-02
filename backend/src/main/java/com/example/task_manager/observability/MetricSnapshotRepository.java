package com.example.task_manager.observability;

import com.example.task_manager.observability.entity.MetricSnapshotEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetricSnapshotRepository extends JpaRepository<MetricSnapshotEntity, UUID> {}
