package com.example.task_manager.config.security.Authorization;

import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TeamAuthorizationService {

  private static final Set<TeamRole> TEAM_MANAGEMENT_ROLES = Set.of(TeamRole.OWNER, TeamRole.ADMIN);

  private final TeamRepository teamRepository;
  private final TeamMemberRepository teamMemberRepository;
  private final UserRepository users;

  /** Ensure team exists Returns active team */
  public TeamEntity requireActiveTeam(String teamKey) {
    return teamRepository
        .findByKeyAndDeletedAtIsNull(teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
  }

  public TeamEntity requireActiveTeamForUpdate(String teamKey) {
    return teamRepository
        .findByKeyForUpdate(teamKey)
        .filter(team -> team.getDeletedAt() == null)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
  }

  public UserEntity requireEnabledAccountForUpdate(UUID id) {
    UserEntity user =
        users
            .findByIdForUpdate(id)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    if (user.isArchived()) throw new ConflictException("This account is archived.");
    return user;
  }

  public TeamMemberEntity requireAssignableMember(UUID teamId, UUID userId) {
    TeamMemberEntity member = requireActiveMembership(teamId, userId);
    if (member.getUser().isArchived()) throw new ConflictException("This account is archived.");
    return member;
  }

  /** Ensure team exists Returns team */
  public TeamEntity requireTeam(String teamKey) {
    return teamRepository
        .findByKey(teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
  }

  /**
   * Ensures: - Team exists - Team is active - Membership exists
   *
   * <p>Returns membership entity.
   */
  public TeamMemberEntity requireActiveMembership(UUID teamId, UUID userId) {
    TeamMemberEntity member =
        teamMemberRepository
            .findByTeamIdAndUserId(teamId, userId)
            .orElseThrow(() -> new ForbiddenException("User is not a team member"));
    if (member.getTeam().getDeletedAt() != null) {
      throw new ConflictException("Team is deleted and cannot be changed");
    }
    return member;
  }

  /** Ensures user is an active member */
  public boolean hasActiveMembership(UUID teamId, UUID userId) {
    return teamMemberRepository.existsByTeamIdAndUserIdAndTeamDeletedAtIsNull(teamId, userId);
  }

  /** Ensures: - User is Team member - Role is Team OWNER or ADMIN */
  public void validateManagerMembership(UUID teamId, UUID userId) {
    TeamMemberEntity member = requireActiveMembership(teamId, userId);

    if (!canManageTeam(member)) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }

  /** Ownership/admin-role recovery does not grant unrelated team-management rights. */
  public void validateRoleAdministrator(UUID teamId, UserEntity requester) {
    if (requester.getRole() == UserRole.SUPER_ADMIN) return;
    if (requireActiveMembership(teamId, requester.getId()).getRole() != TeamRole.OWNER) {
      throw new ForbiddenException("User is not the owner of this team");
    }
  }

  /** Ensures is Team Owner or Admin */
  public boolean canManageTeam(TeamMemberEntity member) {
    return TEAM_MANAGEMENT_ROLES.contains(member.getRole());
  }
}
