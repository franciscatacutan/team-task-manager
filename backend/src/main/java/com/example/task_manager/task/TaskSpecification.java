package com.example.task_manager.task;

import com.example.task_manager.common.DeletedFilter;
import com.example.task_manager.task.entity.TaskEntity;
import com.example.task_manager.task.entity.TaskPriority;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/** Builds dynamic filtering logic for TaskEntity queries. */
public class TaskSpecification {

  public static Specification<TaskEntity> build(
      UUID projectId,
      String search,
      List<TaskStatus> statuses,
      List<TaskPriority> priorities,
      UUID assigneeId,
      UUID supportId,
      Instant overdueBefore,
      DeletedFilter deletedFilter,
      boolean canViewDeleted) {

    return Specification.where(belongsToProject(projectId))
        .and(search(search))
        .and(hasStatuses(statuses))
        .and(hasPriorities(priorities))
        .and(hasAssignee(assigneeId))
        .and(hasSupport(supportId))
        .and(isOverdue(overdueBefore))
        .and(deletedFilter(deletedFilter, canViewDeleted));
  }

  private static Specification<TaskEntity> belongsToProject(UUID projectId) {
    return (root, query, cb) -> cb.equal(root.get("project").get("id"), projectId);
  }

  private static Specification<TaskEntity> search(String keyword) {

    return (root, query, cb) -> {
      if (keyword == null || keyword.isBlank()) {
        return cb.conjunction();
      }

      String term = keyword.strip();
      String pattern = "%" + term.toLowerCase(Locale.ROOT) + "%";
      Long number = parseTaskNumber(term);

      Join<TaskEntity, UserEntity> assigneeJoin = root.join("assignee", JoinType.LEFT);
      Join<TaskEntity, UserEntity> supportJoin = root.join("support", JoinType.LEFT);

      var textMatch =
          cb.or(
              cb.like(cb.lower(root.get("name")), pattern),
              cb.like(cb.lower(root.get("description")), pattern),
              cb.like(cb.lower(assigneeJoin.get("firstName")), pattern),
              cb.like(cb.lower(assigneeJoin.get("lastName")), pattern),
              cb.like(cb.lower(supportJoin.get("firstName")), pattern),
              cb.like(cb.lower(supportJoin.get("lastName")), pattern));
      return number == null
          ? textMatch
          : cb.or(textMatch, cb.equal(root.get("taskNumber"), number));
    };
  }

  private static Long parseTaskNumber(String term) {
    if (!term.matches("#?[0-9]{1,19}")) return null;
    try {
      return Long.valueOf(term.startsWith("#") ? term.substring(1) : term);
    } catch (NumberFormatException tooLarge) {
      return null;
    }
  }

  private static Specification<TaskEntity> hasStatuses(List<TaskStatus> statuses) {

    return (root, query, cb) -> {
      if (statuses == null || statuses.isEmpty()) {
        return cb.conjunction();
      }

      return root.get("status").in(statuses);
    };
  }

  private static Specification<TaskEntity> hasPriorities(List<TaskPriority> priorities) {

    return (root, query, cb) -> {
      if (priorities == null || priorities.isEmpty()) {
        return cb.conjunction();
      }

      return root.get("priority").in(priorities);
    };
  }

  private static Specification<TaskEntity> hasAssignee(UUID assigneeId) {

    return (root, query, cb) ->
        assigneeId == null
            ? cb.conjunction()
            : cb.equal(root.get("assignee").get("id"), assigneeId);
  }

  private static Specification<TaskEntity> hasSupport(UUID supportId) {

    return (root, query, cb) ->
        supportId == null ? cb.conjunction() : cb.equal(root.get("support").get("id"), supportId);
  }

  private static Specification<TaskEntity> isOverdue(Instant before) {
    return (root, query, cb) ->
        before == null
            ? cb.conjunction()
            : cb.and(
                cb.lessThan(root.get("plannedDueDate"), before),
                cb.not(root.get("status").in(TaskPlanningCalendar.CLOSED_STATUSES)),
                cb.isNull(root.get("deletedAt")),
                cb.isNull(root.get("project").get("deletedAt")),
                cb.isNull(root.get("project").get("team").get("deletedAt")));
  }

  private static Specification<TaskEntity> deletedFilter(
      DeletedFilter filter, boolean canViewDeleted) {

    return (root, query, cb) -> {
      var archived =
          cb.or(
              cb.isNotNull(root.get("deletedAt")),
              cb.isNotNull(root.get("project").get("deletedAt")),
              cb.isNotNull(root.get("project").get("team").get("deletedAt")));
      if (!canViewDeleted) {
        return cb.not(archived);
      }

      return switch (filter) {
        case DELETED -> archived;
        case ALL -> cb.conjunction();
        case ACTIVE -> cb.not(archived);
      };
    };
  }
}
