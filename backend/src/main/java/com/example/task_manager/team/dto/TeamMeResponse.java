package com.example.task_manager.team.dto;

import com.example.task_manager.team.entity.TeamRole;
import java.util.UUID;

/** DTO for returning User's team role. */
public record TeamMeResponse(UUID userId, TeamRole role) {}
