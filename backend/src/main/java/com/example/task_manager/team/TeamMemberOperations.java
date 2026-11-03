package com.example.task_manager.team;

import com.example.task_manager.activity.ActivityEventService;
import com.example.task_manager.activity.dto.ActivityEventDetails;
import com.example.task_manager.activity.dto.ActivityEventType;
import com.example.task_manager.config.security.Authorization.GlobalAuthorizationService;
import com.example.task_manager.config.security.Authorization.TeamAuthorizationService;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.team.dto.TeamMemberRequest;
import com.example.task_manager.team.dto.TeamMemberResponse;
import com.example.task_manager.team.entity.TeamEntity;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.team.entity.TeamRole;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One atomic membership change, including its activity, audit, metrics and notifications. */
@Service
@RequiredArgsConstructor
public class TeamMemberOperations {
  private final TeamRepository teams;
  private final TeamMemberRepository members;
  private final UserRepository users;
  private final GlobalAuthorizationService globalAuthorization;
  private final TeamAuthorizationService teamAuthorization;
  private final ActivityEventService activity;
  private final TeamMemberMapper memberMapper;

  @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
  public void validateAccess(String teamKey, String email) {
    var requester = globalAuthorization.getUserByEmail(email);
    var team = teamAuthorization.requireActiveTeam(teamKey);
    teamAuthorization.validateManagerMembership(team.getId(), requester.getId());
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public TeamMemberResponse add(String teamKey, TeamMemberRequest request, String email) {
    var context = context(teamKey, email);
    var user =
        users
            .findById(request.userId())
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    if (members.existsByTeamIdAndUserId(context.team().getId(), user.getId())) {
      throw new ConflictException("User is already a member of the team");
    }
    TeamRole role = request.role() == null ? TeamRole.MEMBER : request.role();
    if (role == TeamRole.OWNER) throw new ConflictException("Cannot assign OWNER role");
    if (role == TeamRole.ADMIN)
      teamAuthorization.validateRoleAdministrator(context.team().getId(), context.requester());
    var member = new TeamMemberEntity();
    member.setTeam(context.team());
    member.setUser(user);
    member.setRole(role);
    member.setAddedBy(context.requester());
    members.saveAndFlush(member);
    context.team().setMembershipChangedAt(Instant.now());
    record(context, member, true);
    return memberMapper.toResponse(member, context.requester());
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void remove(String teamKey, UUID userId, String email) {
    var context = context(teamKey, email);
    var member = teamAuthorization.requireActiveMembership(context.team().getId(), userId);
    if (member.getRole() == TeamRole.OWNER)
      throw new ConflictException("Transfer ownership before removing OWNER");
    if (context.membership().getRole() == TeamRole.ADMIN && member.getRole() != TeamRole.MEMBER) {
      throw new ForbiddenException("ADMIN can only remove MEMBER");
    }
    members.delete(member);
    members.flush();
    context.team().setMembershipChangedAt(Instant.now());
    record(context, member, false);
  }

  private Context context(String teamKey, String email) {
    // Each entry reloads permissions after acquiring the team lock; no stale batch-wide snapshot.
    var team =
        teams
            .findByKeyForUpdate(teamKey)
            .filter(value -> value.getDeletedAt() == null)
            .orElseThrow(() -> new ResourceNotFoundException("Team not found"));
    var requester = globalAuthorization.getUserByEmail(email);
    var membership = teamAuthorization.requireActiveMembership(team.getId(), requester.getId());
    if (!teamAuthorization.canManageTeam(membership))
      throw new ForbiddenException("Insufficient permissions");
    return new Context(team, requester, membership);
  }

  private void record(Context context, TeamMemberEntity member, boolean added) {
    String name = member.getUser().getFullName();
    String role = member.getRole().name();
    var details =
        new ActivityEventDetails(
            List.of("member", "role"),
            added ? null : role,
            added ? role : null,
            name,
            List.of(
                activity.change("member", "member", added ? null : name, added ? name : null),
                activity.change(
                    "role",
                    "role",
                    added ? null : member.getRole(),
                    added ? member.getRole() : null)),
            null,
            null,
            null,
            activity.reference(member.getUser()));
    activity.recordTeamEvent(
        context.team(),
        context.requester(),
        added ? ActivityEventType.TEAM_MEMBER_ADDED : ActivityEventType.TEAM_MEMBER_REMOVED,
        details,
        null);
  }

  private record Context(TeamEntity team, UserEntity requester, TeamMemberEntity membership) {}
}
