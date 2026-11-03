package com.example.task_manager.team;

import com.example.task_manager.team.dto.TeamMemberResponse;
import com.example.task_manager.team.entity.TeamMemberEntity;

final class TeamMemberMapper {
  private TeamMemberMapper() {}

  static TeamMemberResponse toResponse(TeamMemberEntity member) {

    TeamMemberResponse.User user =
        new TeamMemberResponse.User(
            member.getAddedBy().getId(),
            member.getAddedBy().getFirstName(),
            member.getAddedBy().getLastName(),
            member.getAddedBy().getEmail());

    return new TeamMemberResponse(
        member.getUser().getId(),
        member.getUser().getFirstName(),
        member.getUser().getLastName(),
        member.getUser().getEmail(),
        member.getRole(),
        member.getUser().getRole(),
        member.getJoinedAt(),
        user);
  }
}
