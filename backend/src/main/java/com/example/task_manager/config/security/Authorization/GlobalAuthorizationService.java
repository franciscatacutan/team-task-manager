package com.example.task_manager.config.security.Authorization;

import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GlobalAuthorizationService {

  private final UserRepository userRepository;
  private static final Set<UserRole> GLOBAL_ADMIN_ROLES = Set.of(UserRole.ADMIN, UserRole.SUPER_ADMIN);
  private final TeamMemberRepository teamMemberRepository;
  private final TeamAuthorizationService teamAuthorizationService;

  public UserEntity getUserByEmail(String email) {
    return userRepository.findByEmail(email)
        .orElseThrow(() -> new ResourceNotFoundException("User not found"));
  }

  /**
   * Ensures is Global Admin or Super Admin
   */
  public boolean isGlobalAdmin(UserEntity user) {
    return GLOBAL_ADMIN_ROLES.contains(user.getRole());
  }

  /**
   * Ensures user is Global Admin or Super Admin
   */
  public void validateGlobalAdmin(UserRole role) {
    if (!GLOBAL_ADMIN_ROLES.contains(role)) {
      throw new ForbiddenException("You are not allowed to perform this action");
    }
  }

  /**
   * Ensures:
   * - User is able to read deleted team, project, and task
   * - User is Global admin or team owner or admin
   */
  public boolean canViewDeleted(TeamEntity team, UUID requesterId, boolean isGlobalAdmin) {
    if (isGlobalAdmin) {
      return true;
    }

    TeamMemberEntity membership = teamMemberRepository.findByTeamIdAndUserId(team.getId(), requesterId)
        .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

    boolean canManageTeam = teamAuthorizationService.canManageTeam(membership);
    if (team.getDeletedAt() != null && !canManageTeam) {
      throw new ResourceNotFoundException("Team not found");
    }

    return canManageTeam;
  }

}
