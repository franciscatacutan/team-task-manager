package com.example.task_manager.activity;

import com.example.task_manager.activity.entity.ActivityEventEntity;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

/** Repository for unified activity events. */
public interface ActivityEventRepository
    extends JpaRepository<ActivityEventEntity, UUID>,
        JpaSpecificationExecutor<ActivityEventEntity> {
  @Query(
      """
      SELECT e FROM ActivityEventEntity e
      LEFT JOIN e.task t
      WHERE e.taskId = :taskId
      AND (t IS NULL OR t.deletedAt IS NULL)
      """)
  Page<ActivityEventEntity> findActiveTaskActivity(UUID taskId, Pageable pageable);

  Page<ActivityEventEntity> findByTaskId(UUID taskId, Pageable pageable);

  @Query(
      """
      SELECT e FROM ActivityEventEntity e
      WHERE e.projectId = :projectId
      """)
  Page<ActivityEventEntity> findByProjectId(UUID projectId, Pageable pageable);

  @Query(
      """
      SELECT e FROM ActivityEventEntity e
      WHERE e.teamId = :teamId
      """)
  Page<ActivityEventEntity> findTeamActivity(UUID teamId, Pageable pageable);

  long countByTeamIdAndCreatedAtAfter(UUID teamId, Instant createdAt);

  long countByProjectIdAndCreatedAtAfter(UUID projectId, Instant createdAt);
}
