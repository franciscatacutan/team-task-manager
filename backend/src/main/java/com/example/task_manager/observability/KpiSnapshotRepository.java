package com.example.task_manager.observability;

import com.example.task_manager.observability.entity.KpiSnapshotEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KpiSnapshotRepository extends JpaRepository<KpiSnapshotEntity, UUID> {}
