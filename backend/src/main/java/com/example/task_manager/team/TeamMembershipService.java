package com.example.task_manager.team;

import com.example.task_manager.exception.api.ApiException;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.team.dto.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Coordinates partial-success batches without holding a transaction across entries. */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(propagation = Propagation.NOT_SUPPORTED)
public class TeamMembershipService {
  private final TeamMemberOperations operations;

  public AddTeamMembersResponse addMembers(
      String teamKey, AddTeamMembersRequest request, String email) {
    validateUnique(request.members().stream().map(TeamMemberRequest::userId).toList());
    operations.validateAccess(teamKey, email);
    List<TeamMemberResponse> success = new ArrayList<>();
    List<FailedMember> failed = new ArrayList<>();
    for (var member : request.members()) {
      try {
        // The proxied call commits before returning: a failed commit is never reported as success.
        success.add(operations.add(teamKey, member, email));
      } catch (RuntimeException ex) {
        failed.add(failure(teamKey, member.userId(), ex));
      }
    }
    return new AddTeamMembersResponse(success, failed);
  }

  public RemoveTeamMembersResponse removeMembers(
      String teamKey, RemoveTeamMembersRequest request, String email) {
    validateUnique(request.userIds());
    operations.validateAccess(teamKey, email);
    List<UUID> success = new ArrayList<>();
    List<FailedMember> failed = new ArrayList<>();
    for (UUID userId : request.userIds()) {
      try {
        operations.remove(teamKey, userId, email);
        success.add(userId);
      } catch (RuntimeException ex) {
        failed.add(failure(teamKey, userId, ex));
      }
    }
    return new RemoveTeamMembersResponse(success, failed);
  }

  private void validateUnique(List<UUID> ids) {
    if (new HashSet<>(ids).size() != ids.size()) {
      throw new BadRequestInputException("Each user may appear only once per request");
    }
  }

  private FailedMember failure(String teamKey, UUID userId, RuntimeException ex) {
    if (ex instanceof ApiException domain) {
      return new FailedMember(userId, domain.getMessage(), domain.getErrorCode().name());
    }
    log.error("Membership change failed for team {} and user {}", teamKey, userId, ex);
    return new FailedMember(
        userId,
        "Unable to change this member. Please refresh and try again.",
        "MEMBER_CHANGE_FAILED");
  }
}
