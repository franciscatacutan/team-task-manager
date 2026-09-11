package com.example.task_manager.task;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;

/**
 * Repository interface for Task entities.
 */
public interface TaskRepository extends JpaRepository<TaskEntity, UUID>, JpaSpecificationExecutor<TaskEntity> {
  Page<TaskEntity> findByProjectId(UUID projectId, Pageable pageable);

  Optional<TaskEntity> findByTaskNumberAndProjectIdAndProjectTeamIdAndDeletedAtIsNull(Long taskNumber, UUID projectID,
      UUID teamID);

  Optional<TaskEntity> findByTaskNumberAndProjectIdAndProjectTeamId(Long taskNumber, UUID projectID, UUID teamID);

  Optional<TaskEntity> findByIdAndProjectTeamId(UUID taskId, UUID teamId);

  boolean existsByIdAndDeletedAtIsNull(UUID id);

  Page<TaskEntity> findByProjectIdAndDeletedAtIsNull(UUID projectId, Pageable pageable);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("""
          UPDATE TaskEntity t
          SET t.deletedAt = :deletedAt
          WHERE t.project.id = :projectId
            AND t.deletedAt IS NULL
      """)
  int softDeleteByProjectId(UUID projectId, Instant deletedAt);

  @Modifying(clearAutomatically = true)
  @Query("""
          UPDATE TaskEntity t
          SET t.deletedAt = :deletedAt
          WHERE t.project.team.id = :teamId
            AND t.deletedAt IS NULL
      """)
  int softDeleteByTeamId(UUID teamId, Instant deletedAt);

  @Query("""
          SELECT t FROM TaskEntity t
          WHERE t.deletedAt IS NULL
          AND (
              t.assignee.id = :userId
              OR t.support.id = :userId
          )
      """)
  Page<TaskEntity> findMyTasks(UUID userId, Pageable pageable);

  @Query("""
          SELECT t FROM TaskEntity t
          WHERE t.deletedAt IS NULL
          AND t.project.key = :projectKey
          AND (
              t.assignee.id = :userId
              OR t.support.id = :userId
          )
      """)
  Page<TaskEntity> findMyTasksByProject(
      String projectKey,
      UUID userId,
      Pageable pageable);

  List<TaskEntity> findAllByProjectTeamIdAndDeletedAtIsNull(UUID teamId);

  List<TaskEntity> findAllByProjectIdAndDeletedAtIsNull(UUID projectId);

  long countByProjectTeamIdAndDeletedAtIsNull(UUID teamId);

  long countByProjectTeamIdAndStatusAndDeletedAtIsNull(UUID teamId, TaskStatus status);

  long countByProjectTeamIdAndPriorityAndDeletedAtIsNull(UUID teamId, TaskPriority priority);

  long countByProjectIdAndDeletedAtIsNull(UUID projectId);

  long countByProjectIdAndStatusAndDeletedAtIsNull(UUID projectId, TaskStatus status);

  long countByProjectIdAndPriorityAndDeletedAtIsNull(UUID projectId, TaskPriority priority);

  long countByProjectTeamIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(
      UUID teamId,
      TaskStatus status,
      Instant actualCompletionDate);

  long countByProjectIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(
      UUID projectId,
      TaskStatus status,
      Instant actualCompletionDate);

  List<TaskEntity> findTop500ByProjectTeamIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
      UUID teamId,
      TaskStatus status);

  List<TaskEntity> findTop500ByProjectIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
      UUID projectId,
      TaskStatus status);

  @Query("""
      SELECT COUNT(t)
      FROM TaskEntity t
      WHERE t.project.team.id = :teamId
        AND t.deletedAt IS NULL
        AND t.plannedDueDate < :now
        AND t.status NOT IN :terminalStatuses
      """)
  long countOverdueOpenTasks(UUID teamId, Instant now, List<TaskStatus> terminalStatuses);

  @Query("""
      SELECT COUNT(t)
      FROM TaskEntity t
      WHERE t.project.id = :projectId
        AND t.deletedAt IS NULL
        AND t.plannedDueDate < :now
        AND t.status NOT IN :terminalStatuses
      """)
  long countOverdueOpenTasksByProject(UUID projectId, Instant now, List<TaskStatus> terminalStatuses);

  @Modifying
  @Query("""
      UPDATE TaskEntity t
      SET t.lastActivityAt = :timestamp
      WHERE t.id = :taskId
      AND (t.lastActivityAt IS NULL OR t.lastActivityAt < :timestamp)
      """)
  void updateLastActivity(UUID taskId, Instant timestamp);
}
