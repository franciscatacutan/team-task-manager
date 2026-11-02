package com.example.task_manager.team;

import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

/** Builds dynamic filtering logic for TeamMemberEntity queries. */
public final class TeamMemberSpecification {

  private TeamMemberSpecification() {}

  public static Specification<TeamMemberEntity> build(
      UUID teamId, String search, Set<TeamRole> roles) {

    return Specification.where(belongsToTeam(teamId)).and(search(search)).and(hasRoles(roles));
  }

  private static Specification<TeamMemberEntity> belongsToTeam(UUID teamId) {
    return (root, query, cb) ->
        teamId == null ? cb.conjunction() : cb.equal(root.get("team").get("id"), teamId);
  }

  private static Specification<TeamMemberEntity> search(String keyword) {
    return (root, query, cb) -> {
      if (keyword == null || keyword.isBlank()) {
        return cb.conjunction();
      }

      String pattern = "%" + keyword.toLowerCase(Locale.ROOT) + "%";
      Join<TeamMemberEntity, UserEntity> user = root.join("user", JoinType.LEFT);

      return cb.or(
          cb.like(cb.lower(user.get("firstName")), pattern),
          cb.like(cb.lower(user.get("lastName")), pattern),
          cb.like(cb.lower(user.get("email")), pattern));
    };
  }

  private static Specification<TeamMemberEntity> hasRoles(Set<TeamRole> roles) {
    return (root, query, cb) ->
        roles == null || roles.isEmpty() ? cb.conjunction() : root.get("role").in(roles);
  }
}
