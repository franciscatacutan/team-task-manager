package com.example.task_manager.team;

import com.example.task_manager.team.dto.TeamMemberResponse;
import com.example.task_manager.team.entity.TeamMemberEntity;
import com.example.task_manager.user.UserVisibilityPolicy;
import com.example.task_manager.user.entity.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
final class TeamMemberMapper {
  private final UserVisibilityPolicy visibility;

  TeamMemberResponse toResponse(TeamMemberEntity member, UserEntity viewer) {
    TeamMemberResponse.User addedBy =
        new TeamMemberResponse.User(
            member.getAddedBy().getId(), member.getAddedBy().getFirstName(),
            member.getAddedBy().getLastName(), member.getAddedBy().getEmail());
    return new TeamMemberResponse(
        member.getUser().getId(),
        member.getUser().getFirstName(),
        member.getUser().getLastName(),
        member.getUser().getEmail(),
        member.getRole(),
        visibility.visibleGlobalRole(viewer, member.getUser()),
        member.getJoinedAt(),
        addedBy);
  }
}
