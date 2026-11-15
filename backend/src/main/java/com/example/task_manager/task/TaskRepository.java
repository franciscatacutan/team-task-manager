package com.example.task_manager.task;

import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.user.entity.UserEntity;
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

/** Repository interface for Task entities. */
public interface TaskRepository
    extends JpaRepository<TaskEntity, UUID>, JpaSpecificationExecutor<TaskEntity> {
  Page<TaskEntity> findByProjectId(UUID projectId, Pageable pageable);

  @Query(
      """
      SELECT u FROM UserEntity u
      WHERE u.id = coalesce(:assigneeId, u.id)
        AND (
          lower(concat(u.firstName, ' ', u.lastName)) LIKE :pattern ESCAPE '!'
          OR lower(u.email) LIKE :pattern ESCAPE '!'
        )
        AND EXISTS (
          SELECT 1 FROM TaskEntity t
          WHERE t.project.id = :projectId AND t.assignee.id = u.id
            AND (
              (:includeActive = true AND :archivedProject = false AND t.deletedAt IS NULL)
              OR (:includeArchived = true AND (:archivedProject = true OR t.deletedAt IS NOT NULL))
            )
        )
      ORDER BY lower(u.lastName), lower(u.firstName), u.id
      """)
  Page<UserEntity> findVisibleAssignees(
      UUID projectId,
      UUID assigneeId,
      String pattern,
      boolean archivedProject,
      boolean includeActive,
      boolean includeArchived,
      Pageable pageable);

  Optional<TaskEntity> findByTaskNumberAndProjectIdAndProjectTeamIdAndDeletedAtIsNull(
      Long taskNumber, UUID projectID, UUID teamID);

  Optional<TaskEntity> findByTaskNumberAndProjectIdAndProjectTeamId(
      Long taskNumber, UUID projectID, UUID teamID);

  Optional<TaskEntity> findByIdAndProjectTeamId(UUID taskId, UUID teamId);

  boolean existsByIdAndDeletedAtIsNull(UUID id);

  Page<TaskEntity> findByProjectIdAndDeletedAtIsNull(UUID projectId, Pageable pageable);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      """
          UPDATE TaskEntity t
          SET t.deletedAt = :deletedAt
          WHERE t.project.id = :projectId
            AND t.deletedAt IS NULL
      """)
  int softDeleteByProjectId(UUID projectId, Instant deletedAt);

  @Modifying(clearAutomatically = true)
  @Query(
      """
          UPDATE TaskEntity t
          SET t.deletedAt = :deletedAt
          WHERE t.project.team.id = :teamId
            AND t.deletedAt IS NULL
      """)
  int softDeleteByTeamId(UUID teamId, Instant deletedAt);

  @Query(
      """
      SELECT t FROM TaskEntity t
      WHERE t.project.id = :projectId
        AND t.deletedAt IS NULL
        AND t.project.deletedAt IS NULL
        AND t.project.team.deletedAt IS NULL
        AND (t.assignee.id = :userId OR t.support.id = :userId)
        AND EXISTS (
          SELECT m.id FROM TeamMemberEntity m
          WHERE m.team.id = t.project.team.id AND m.user.id = :userId
        )
      """)
  Page<TaskEntity> findMyTasksByProject(UUID projectId, UUID userId, Pageable pageable);

  @Query(
      value =
          """
      SELECT t FROM TaskEntity t
      JOIN FETCH t.project p
      JOIN FETCH p.team tm
      WHERE t.deletedAt IS NULL AND p.deletedAt IS NULL AND tm.deletedAt IS NULL
        AND t.status NOT IN :closedStatuses
        AND (t.assignee.id = :userId OR t.support.id = :userId)
      ORDER BY t.id
      """,
      countQuery =
          """
      SELECT count(t) FROM TaskEntity t
      WHERE t.deletedAt IS NULL AND t.project.deletedAt IS NULL AND t.project.team.deletedAt IS NULL
        AND t.status NOT IN :closedStatuses
        AND (t.assignee.id = :userId OR t.support.id = :userId)
      """)
  Page<TaskEntity> findOpenWorkForAccount(
      UUID userId, List<TaskStatus> closedStatuses, Pageable pageable);

  String MY_WORK_SCOPE =
      """
      FROM TaskEntity t
      JOIN t.project p
      JOIN p.team tm
      WHERE t.deletedAt IS NULL AND p.deletedAt IS NULL AND tm.deletedAt IS NULL
        AND t.status <> com.example.task_manager.task.entity.TaskStatus.DELETED
        AND (:includeClosed = true OR t.status NOT IN :closedStatuses)
        AND (t.assignee.id = :userId OR t.support.id = :userId)
        AND EXISTS (
          SELECT m.id FROM TeamMemberEntity m
          WHERE m.team.id = tm.id AND m.user.id = :userId
        )
      """;

  @Query(
      value =
          """
          SELECT t.taskNumber AS taskNumber, t.name AS name, t.status AS status,
            t.priority AS priority, t.plannedDueDate AS plannedDueDate,
            tm.key AS teamKey, tm.name AS teamName, p.key AS projectKey, p.name AS projectName,
            CASE WHEN t.assignee.id = :userId THEN true ELSE false END AS assigned
          """
              + MY_WORK_SCOPE
              + "ORDER BY coalesce(t.lastActivityAt, t.createdAt) DESC, t.id",
      countQuery = "SELECT count(t) " + MY_WORK_SCOPE)
  Page<MyWorkRow> findMyWork(
      UUID userId, boolean includeClosed, List<TaskStatus> closedStatuses, Pageable pageable);

  interface MyWorkRow {
    long getTaskNumber();

    String getName();

    TaskStatus getStatus();

    TaskPriority getPriority();

    Instant getPlannedDueDate();

    String getTeamKey();

    String getTeamName();

    String getProjectKey();

    String getProjectName();

    boolean getAssigned();
  }

  List<TaskEntity> findAllByProjectTeamIdAndDeletedAtIsNull(UUID teamId);

  List<TaskEntity> findAllByProjectIdAndDeletedAtIsNull(UUID projectId);

  long countByProjectTeamIdAndDeletedAtIsNull(UUID teamId);

  long countByProjectTeamIdAndStatusAndDeletedAtIsNull(UUID teamId, TaskStatus status);

  long countByProjectTeamIdAndPriorityAndDeletedAtIsNull(UUID teamId, TaskPriority priority);

  long countByProjectIdAndDeletedAtIsNull(UUID projectId);

  long countByProjectIdAndStatusAndDeletedAtIsNull(UUID projectId, TaskStatus status);

  long countByProjectIdAndStatusNotInAndDeletedAtIsNull(
      UUID projectId, List<TaskStatus> closedStatuses);

  long countByProjectIdAndPriorityAndDeletedAtIsNull(UUID projectId, TaskPriority priority);

  long countByProjectTeamIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(
      UUID teamId, TaskStatus status, Instant actualCompletionDate);

  long countByProjectIdAndStatusAndActualCompletionDateAfterAndDeletedAtIsNull(
      UUID projectId, TaskStatus status, Instant actualCompletionDate);

  List<TaskEntity>
      findTop500ByProjectTeamIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
          UUID teamId, TaskStatus status);

  List<TaskEntity>
      findTop500ByProjectIdAndStatusAndActualStartDateIsNotNullAndActualCompletionDateIsNotNullAndDeletedAtIsNullOrderByActualCompletionDateDesc(
          UUID projectId, TaskStatus status);

  String TEAM_OVERDUE_TASKS =
      """
      FROM TaskEntity t
      JOIN t.project p
      JOIN p.team tm
      WHERE tm.id = :teamId
        AND t.deletedAt IS NULL
        AND p.deletedAt IS NULL
        AND tm.deletedAt IS NULL
        AND t.plannedDueDate < :before
        AND t.status NOT IN :terminalStatuses
      """;

  @Query("SELECT count(t) " + TEAM_OVERDUE_TASKS)
  long countOverdueOpenTasks(UUID teamId, Instant before, List<TaskStatus> terminalStatuses);

  @Query(
      value =
          """
          SELECT t.taskNumber AS taskNumber, t.name AS name, t.status AS status,
            t.priority AS priority, t.plannedDueDate AS plannedDueDate,
            p.key AS projectKey, p.name AS projectName
          """
              + TEAM_OVERDUE_TASKS
              + "ORDER BY t.plannedDueDate ASC, t.id ASC",
      countQuery = "SELECT count(t) " + TEAM_OVERDUE_TASKS)
  Page<TeamOverdueTaskRow> findTeamOverdueTasks(
      UUID teamId, Instant before, List<TaskStatus> terminalStatuses, Pageable pageable);

  interface TeamOverdueTaskRow {
    long getTaskNumber();

    String getName();

    TaskStatus getStatus();

    TaskPriority getPriority();

    Instant getPlannedDueDate();

    String getProjectKey();

    String getProjectName();
  }

  @Query(
      """
      SELECT COUNT(t)
      FROM TaskEntity t
      WHERE t.project.id = :projectId
        AND t.deletedAt IS NULL
        AND t.project.deletedAt IS NULL
        AND t.project.team.deletedAt IS NULL
        AND t.plannedDueDate < :before
        AND t.status NOT IN :terminalStatuses
      """)
  long countOverdueOpenTasksByProject(
      UUID projectId, Instant before, List<TaskStatus> terminalStatuses);

  @Modifying
  @Query(
      """
      UPDATE TaskEntity t
      SET t.lastActivityAt = :timestamp
      WHERE t.id = :taskId
      AND (t.lastActivityAt IS NULL OR t.lastActivityAt < :timestamp)
      """)
  void updateLastActivity(UUID taskId, Instant timestamp);
}
