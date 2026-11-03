package com.example.task_manager.project;

import com.example.task_manager.common.DeletedFilter;
import com.example.task_manager.project.entity.ProjectEntity;
import com.example.task_manager.project.entity.ProjectStatus;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/** Builds dynamic filtering logic for ProjectEntity queries. */
public final class ProjectSpecification {

  private ProjectSpecification() {}

  public static Specification<ProjectEntity> build(
      UUID teamId,
      String search,
      List<ProjectStatus> status,
      UUID createdBy,
      DeletedFilter deletedFilter,
      boolean canViewDeleted) {

    return Specification.where(belongsToTeam(teamId))
        .and(search(search))
        .and(hasStatuses(status))
        .and(hasCreatedBy(createdBy))
        .and(deletedFilter(deletedFilter, canViewDeleted));
  }

  private static Specification<ProjectEntity> belongsToTeam(UUID teamId) {
    return (root, query, cb) -> cb.equal(root.get("team").get("id"), teamId);
  }

  private static Specification<ProjectEntity> search(String keyword) {

    return (root, query, cb) -> {
      if (keyword == null || keyword.isBlank()) {
        return cb.conjunction();
      }

      String pattern = "%" + keyword.toLowerCase(Locale.ROOT) + "%";

      Join<ProjectEntity, UserEntity> creatorJoin = root.join("createdBy", JoinType.LEFT);

      return cb.or(
          cb.like(cb.lower(root.get("name")), pattern),
          cb.like(cb.lower(root.get("description")), pattern),
          cb.like(cb.lower(creatorJoin.get("firstName")), pattern),
          cb.like(cb.lower(creatorJoin.get("lastName")), pattern));
    };
  }

  private static Specification<ProjectEntity> hasStatuses(List<ProjectStatus> statuses) {

    return (root, query, cb) -> {
      if (statuses == null || statuses.isEmpty()) {
        return cb.conjunction();
      }

      return root.get("status").in(statuses);
    };
  }

  private static Specification<ProjectEntity> hasCreatedBy(UUID ownerId) {

    return (root, query, cb) ->
        ownerId == null ? cb.conjunction() : cb.equal(root.get("createdBy").get("id"), ownerId);
  }

  private static Specification<ProjectEntity> deletedFilter(
      DeletedFilter filter, boolean canViewDeleted) {

    return (root, query, cb) -> {
      var archived =
          cb.or(
              cb.isNotNull(root.get("deletedAt")), cb.isNotNull(root.get("team").get("deletedAt")));
      if (!canViewDeleted) {
        return cb.not(archived);
      }

      return switch (filter == null ? DeletedFilter.ACTIVE : filter) {
        case DELETED -> archived;
        case ALL -> cb.conjunction();
        case ACTIVE -> cb.not(archived);
      };
    };
  }
}
