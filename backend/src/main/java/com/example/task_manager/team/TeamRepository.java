package com.example.task_manager.team;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.example.task_manager.team.entity.TeamEntity;

/**
 * Repository interface for Team entities.
 */
public interface TeamRepository extends JpaRepository<TeamEntity, UUID>, JpaSpecificationExecutor<TeamEntity> {
  boolean existsByOwnerIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID teamId, String name);

  Optional<TeamEntity> findByKey(String teamKey);

  boolean existsByKey(String teamKey);

  Optional<TeamEntity> findByKeyAndDeletedAtIsNull(String teamKey);

  @Modifying
  @Query("""
      UPDATE TeamEntity t
      SET t.lastActivityAt = :timestamp
      WHERE t.id = :teamId
      AND (t.lastActivityAt IS NULL OR t.lastActivityAt < :timestamp)
      """)
  void updateLastActivity(UUID teamId, Instant timestamp);
}
