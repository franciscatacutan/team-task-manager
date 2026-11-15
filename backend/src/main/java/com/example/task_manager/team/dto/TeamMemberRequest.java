package com.example.task_manager.team.dto;

import com.example.task_manager.team.entity.TeamRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** DTO for adding member of a team. */
public record TeamMemberRequest(@NotNull UUID userId, TeamRole role) {}
