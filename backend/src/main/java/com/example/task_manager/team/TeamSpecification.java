package com.example.task_manager.team;

import com.example.task_manager.common.DeletedFilter;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Subquery;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/** Builds dynamic filtering logic for TeamEntity queries. */
public final class TeamSpecification {

  private TeamSpecification() {}

  public static Specification<TeamEntity> build(
      UUID requesterId,
      String search,
      UUID ownerId,
      UUID memberId,
      DeletedFilter deletedFilter,
      boolean isGlobalAdmin) {

    return Specification.where(search(search))
        .and(hasOwner(ownerId))
        .and(hasMember(memberId))
        .and(isVisibleTo(requesterId, isGlobalAdmin))
        .and(hasDeletedState(deletedFilter));
  }

  private static Specification<TeamEntity> search(String keyword) {

    return (root, query, cb) -> {
      if (keyword == null || keyword.isBlank()) {
        return cb.conjunction();
      }

      String pattern = "%" + keyword.toLowerCase(Locale.ROOT) + "%";

      Join<TeamEntity, UserEntity> ownerJoin = root.join("owner", JoinType.LEFT);

      return cb.or(
          cb.like(cb.lower(root.get("name")), pattern),
          cb.like(cb.lower(root.get("description")), pattern),
          cb.like(cb.lower(ownerJoin.get("firstName")), pattern),
          cb.like(cb.lower(ownerJoin.get("lastName")), pattern));
    };
  }

  private static Specification<TeamEntity> hasOwner(UUID ownerId) {

    return (root, query, cb) ->
        ownerId == null ? cb.conjunction() : cb.equal(root.get("owner").get("id"), ownerId);
  }

  private static Specification<TeamEntity> hasMember(UUID memberId) {

    return (root, query, cb) -> {
      if (memberId == null) {
        return cb.conjunction();
      }

      Join<TeamEntity, TeamMemberEntity> memberJoin = root.join("members", JoinType.LEFT);

      return cb.equal(memberJoin.get("user").get("id"), memberId);
    };
  }

  private static Specification<TeamEntity> isVisibleTo(UUID requesterId, boolean isGlobalAdmin) {

    return (root, query, cb) -> {
      if (isGlobalAdmin) {
        return cb.conjunction();
      }

      query.distinct(true);

      return cb.or(
          cb.and(
              cb.isNull(root.get("deletedAt")),
              cb.or(
                  cb.equal(root.get("owner").get("id"), requesterId),
                  hasMembership(root, query, cb, requesterId))),
          cb.and(
              cb.isNotNull(root.get("deletedAt")),
              cb.or(
                  cb.equal(root.get("owner").get("id"), requesterId),
                  hasManagementMembership(root, query, cb, requesterId))));
    };
  }

  private static Specification<TeamEntity> hasDeletedState(DeletedFilter filter) {
    return (root, query, cb) ->
        switch (filter == null ? DeletedFilter.ACTIVE : filter) {
          case ACTIVE -> cb.isNull(root.get("deletedAt"));
          case DELETED -> cb.isNotNull(root.get("deletedAt"));
          case ALL -> cb.conjunction();
        };
  }

  private static jakarta.persistence.criteria.Predicate hasMembership(
      jakarta.persistence.criteria.Root<TeamEntity> root,
      jakarta.persistence.criteria.CriteriaQuery<?> query,
      jakarta.persistence.criteria.CriteriaBuilder cb,
      UUID requesterId) {

    Subquery<UUID> subquery = query.subquery(UUID.class);
    var member = subquery.from(TeamMemberEntity.class);
    subquery
        .select(member.get("id"))
        .where(
            cb.equal(member.get("team").get("id"), root.get("id")),
            cb.equal(member.get("user").get("id"), requesterId));

    return cb.exists(subquery);
  }

  private static jakarta.persistence.criteria.Predicate hasManagementMembership(
      jakarta.persistence.criteria.Root<TeamEntity> root,
      jakarta.persistence.criteria.CriteriaQuery<?> query,
      jakarta.persistence.criteria.CriteriaBuilder cb,
      UUID requesterId) {

    Subquery<UUID> subquery = query.subquery(UUID.class);
    var member = subquery.from(TeamMemberEntity.class);
    subquery
        .select(member.get("id"))
        .where(
            cb.equal(member.get("team").get("id"), root.get("id")),
            cb.equal(member.get("user").get("id"), requesterId),
            member.get("role").in(TeamRole.OWNER, TeamRole.ADMIN));

    return cb.exists(subquery);
  }
}
