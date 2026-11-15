package com.example.task_manager.user;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.UserNotFoundException;
import com.example.task_manager.task.TaskRepository;
import com.example.task_manager.task.entity.TaskStatus;
import com.example.task_manager.team.TeamMemberRepository;
import com.example.task_manager.team.TeamRepository;
import com.example.task_manager.user.dto.UserAccessReview;
import com.example.task_manager.user.dto.UserAccessReview.OpenTask;
import com.example.task_manager.user.dto.UserAccessReview.RestoreRequest;
import com.example.task_manager.user.dto.UserAccessReview.TeamAccess;
import com.example.task_manager.user.dto.UserResponse;
import com.example.task_manager.user.entity.UserEntity;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
public class UserLifecycleService {
  private final UserRepository users;
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final TaskRepository tasks;
  private final UserService userService;
  private final UserVisibilityPolicy visibility;
  private final RefreshTokenService sessions;

  @Transactional(readOnly = true)
  public UserAccessReview review(UUID id, String email, int page) {
    UserEntity actor = users.findByEmailIgnoreCase(email).orElseThrow(UserNotFoundException::new);
    UserEntity target = users.findById(id).orElseThrow(UserNotFoundException::new);
    userService.assertCanManageTargetUser(actor, target);
    requireOtherAccount(actor, target);

    var work =
        tasks.findOpenWorkForAccount(
            id,
            List.of(TaskStatus.DONE, TaskStatus.CANCELLED, TaskStatus.DELETED),
            PageRequest.of(Math.max(0, page), 10));
    var openTasks =
        work.map(
            task ->
                new OpenTask(
                    task.getProject().getTeam().getKey(),
                    task.getProject().getKey(),
                    task.getTaskNumber(),
                    task.getName(),
                    task.getAssignee().getId().equals(id)));

    return new UserAccessReview(
        target.getArchivedAt(),
        target.getRole(),
        teamAccess(id),
        new PageResponse<>(
            openTasks.getContent(),
            work.getNumber(),
            work.getSize(),
            work.getTotalElements(),
            work.getTotalPages(),
            work.isFirst(),
            work.isLast()));
  }

  @Transactional
  public UserResponse archive(UUID id, String email) {
    var accounts = userService.lockManagedAccounts(id, email);
    UserEntity target = accounts.target();
    requireOtherAccount(accounts.requester(), target);
    if (!target.isArchived()) {
      if (teams.existsByOwnerIdAndDeletedAtIsNull(id)) {
        throw new ConflictException(
            "Transfer ownership of the user's active teams before archiving.");
      }
      target.setArchivedAt(Instant.now());
      sessions.revokeAllForUser(id);
    }
    return visibility.toResponse(target, accounts.requester());
  }

  @Transactional
  public UserResponse restore(UUID id, String email, RestoreRequest request) {
    var accounts = userService.lockManagedAccounts(id, email);
    UserEntity target = accounts.target();
    requireOtherAccount(accounts.requester(), target);
    if (!request.archivedAt().equals(target.getArchivedAt())
        || request.role() != target.getRole()
        || !request.teams().stream()
            .sorted(Comparator.comparing(TeamAccess::key))
            .toList()
            .equals(teamAccess(id))) {
      throw new ConflictException("Account access changed. Refresh the review before restoring.");
    }
    target.setArchivedAt(null);
    return visibility.toResponse(target, accounts.requester());
  }

  private List<TeamAccess> teamAccess(UUID id) {
    return members.findVisibleTeamSummariesForUser(id, id, true).stream()
        .map(
            member ->
                new TeamAccess(
                    member.getTeam().getKey(),
                    member.getTeam().getName(),
                    member.getRole(),
                    member.getTeam().getDeletedAt() != null))
        .sorted(Comparator.comparing(TeamAccess::key))
        .toList();
  }

  private void requireOtherAccount(UserEntity actor, UserEntity target) {
    if (actor.getId().equals(target.getId())) {
      throw new ForbiddenException("You cannot archive or restore your own account.");
    }
  }
}
