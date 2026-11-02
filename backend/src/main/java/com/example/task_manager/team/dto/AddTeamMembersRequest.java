package com.example.task_manager.team.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/** DTO for adding members to a team. */
public record AddTeamMembersRequest(@NotEmpty List<@Valid TeamMemberRequest> members) {}
