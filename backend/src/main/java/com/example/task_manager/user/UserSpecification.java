package com.example.task_manager.user;

import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;

import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.user.entity.UserRole;
import com.example.task_manager.user.entity.UserEntity;

public class UserSpecification {

  public static Specification<UserEntity> build(
      String search,
      Set<UserRole> roles) {

    return Specification
        .where(search(search))
        .and(hasRoles(roles));
  }

  /**
   * Search by user name or email
   */
  private static Specification<UserEntity> search(String keyword) {
    return (root, query, cb) -> {

      if (keyword == null || keyword.isBlank()) {
        return cb.conjunction();
      }

      String pattern = "%" + keyword.toLowerCase() + "%";

      return cb.or(
          cb.like(cb.lower(root.get("firstName")), pattern),
          cb.like(cb.lower(root.get("lastName")), pattern),
          cb.like(cb.lower(root.get("email")), pattern));
    };
  }

  private static Specification<UserEntity> hasRoles(Set<UserRole> roles) {
    return (root, query, cb) -> {

      if (roles == null || roles.isEmpty()) {
        return cb.conjunction();
      }

      return root.get("role").in(roles);
    };
  }

  public static Specification<UserEntity> availableUsers(
      String teamKey,
      String search) {
    return (root, query, cb) -> {

      var predicates = cb.conjunction();

      var subquery = query.subquery(UUID.class);
      var subRoot = subquery.from(TeamMemberEntity.class);

      subquery.select(subRoot.get("user").get("id"))
          .where(cb.equal(subRoot.get("team").get("key"), teamKey));

      predicates = cb.and(predicates,
          cb.not(root.get("id").in(subquery)));

      if (search != null && !search.isBlank()) {
        String like = "%" + search.toLowerCase() + "%";

        predicates = cb.and(predicates,
            cb.or(
                cb.like(cb.lower(root.get("firstName")), like),
                cb.like(cb.lower(root.get("lastName")), like),
                cb.like(cb.lower(root.get("email")), like)));
      }

      return predicates;
    };
  }
}