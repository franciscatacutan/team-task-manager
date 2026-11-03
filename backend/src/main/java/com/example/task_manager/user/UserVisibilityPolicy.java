package com.example.task_manager.user;

import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.exception.api.UserNotFoundException;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.user.dto.UserResponse;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Viewer-aware identity disclosure; team roles remain independent of global account roles. */
@Component
@RequiredArgsConstructor
public class UserVisibilityPolicy {
  private final TeamMemberRepository members;
  private final GlobalAuthorizationService globalAuthorization;

  public boolean canViewGlobalRole(UserEntity viewer, UserEntity subject) {
    return viewer.getId().equals(subject.getId()) || globalAuthorization.isGlobalAdmin(viewer);
  }

  public void requireProfileAccess(UserEntity viewer, UserEntity subject) {
    if (!canViewGlobalRole(viewer, subject)
        && !members.sharesActiveTeam(viewer.getId(), subject.getId())) {
      // Do not distinguish an inaccessible identity from an unknown UUID.
      throw new UserNotFoundException();
    }
  }

  public UserRole visibleGlobalRole(UserEntity viewer, UserEntity subject) {
    return canViewGlobalRole(viewer, subject) ? subject.getRole() : null;
  }

  public UserResponse toResponse(UserEntity subject, UserEntity viewer) {
    return new UserResponse(
        subject.getId(),
        subject.getFirstName(),
        subject.getLastName(),
        subject.getEmail(),
        visibleGlobalRole(viewer, subject));
  }
}
