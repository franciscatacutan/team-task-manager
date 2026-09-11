package com.example.task_manager.config.security.Authorization;

import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class TeamAuthorizationService {

  private static final Set<TeamRole> TEAM_MANAGEMENT_ROLES = Set.of(TeamRole.OWNER, TeamRole.ADMIN);

  private final TeamRepository teamRepository;
  private final TeamMemberRepository teamMemberRepository;

  /**
   * Ensure team exists
   * Returns active team
   */
  public TeamEntity requireActiveTeam(String teamKey) {
    return teamRepository.findByKeyAndDeletedAtIsNull(teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
  }

  /**
   * Ensure team exists
   * Returns team
   */
  public TeamEntity requireTeam(String teamKey) {
    return teamRepository.findByKey(teamKey)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
  }

  /**
   * Ensures:
   * - Team exists
   * - Team is active
   * - Membership exists
   *
   * Returns membership entity.
   */
  public TeamMemberEntity requireActiveMembership(UUID teamId, UUID userId) {
    TeamMemberEntity member = teamMemberRepository
        .findByTeamIdAndUserId(teamId, userId)
        .orElseThrow(() -> new ForbiddenException("User is not a team member"));
    if (member.getTeam().getDeletedAt() != null) {
      throw new ConflictException("Team is deleted and cannot be changed");
    }
    return member;
  }

  /**
   * Ensures user is an active member
   */
  public boolean hasActiveMembership(UUID teamId, UUID userId) {
    return teamMemberRepository.existsByTeamIdAndUserIdAndTeamDeletedAtIsNull(teamId, userId);
  }

  /**
   * Ensures:
   * - User is Team member
   * - Role is Team OWNER or ADMIN
   */
  public void validateManagerMembership(UUID teamId, UUID userId) {
    TeamMemberEntity member = requireActiveMembership(teamId, userId);

    if (!canManageTeam(member)) {
      throw new ForbiddenException("Insufficient permissions");
    }

  }

  /**
   * Ensures is Team Owner or Admin
   */
  public boolean canManageTeam(TeamMemberEntity member) {
    return TEAM_MANAGEMENT_ROLES.contains(member.getRole());
  }

}