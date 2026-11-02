package com.example.task_manager.team.dto;

import java.util.List;

/** DTO for returning added/failed team member information. */
public record AddTeamMembersResponse(List<TeamMemberResponse> success, List<FailedMember> failed) {}
