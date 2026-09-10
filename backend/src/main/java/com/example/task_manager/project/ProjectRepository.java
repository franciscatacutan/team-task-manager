package com.example.task_manager.project;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.project.entity.ProjectStatus;

/**
 * Repository interface for Project entities.
 */
public interface ProjectRepository extends JpaRepository<ProjectEntity, UUID>, JpaSpecificationExecutor<ProjectEntity> {

  Optional<ProjectEntity> findByKeyAndTeamKey(String projectKey, String teamKey);

  Optional<ProjectEntity> findByIdAndTeamId(UUID projectId, UUID teamId);

  Optional<ProjectEntity> findByKeyAndTeamIdAndDeletedAtIsNull(String projectKey, UUID teamId);

  Optional<ProjectEntity> findByIdAndTeamIdAndDeletedAtIsNull(UUID projectId, UUID teamId);

  boolean existsByKey(String projectKey);

  boolean existsByIdAndTeamIdAndDeletedAtIsNull(UUID projectId, UUID teamId);

  boolean existsByTeamIdAndNameIgnoreCaseAndDeletedAtIsNull(UUID teamId, String name);

  @Modifying(clearAutomatically = true)
  @Query("""
          UPDATE ProjectEntity p
          SET p.deletedAt = :deletedAt
          WHERE p.team.id = :teamId
            AND p.deletedAt IS NULL
      """)
  int softDeleteByTeamId(UUID teamId, Instant deletedAt);

  List<ProjectEntity> findAllByTeamIdAndDeletedAtIsNull(UUID teamId);

  long countByTeamIdAndDeletedAtIsNull(UUID teamId);

  long countByTeamIdAndStatusAndDeletedAtIsNull(UUID teamId, ProjectStatus status);

  long countByTeamIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(
      UUID teamId,
      ProjectStatus status,
      Instant actualCompletionDate);

  @Modifying
  @Query("""
      UPDATE ProjectEntity p
      SET p.lastActivityAt = :timestamp
      WHERE p.id = :projectId
      AND (p.lastActivityAt IS NULL OR p.lastActivityAt < :timestamp)
      """)
  void updateLastActivity(UUID projectId, Instant timestamp);
}
