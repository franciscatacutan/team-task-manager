package com.example.task_manager.team.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

/** DTO for removing members of a team. */
public record RemoveTeamMembersRequest(@NotEmpty List<@NotNull UUID> userIds) {}
