package com.example.task_manager.team.dto;

import com.example.task_manager.team.entity.TeamRole;
import jakarta.validation.constraints.NotNull;

/*
 * DTO for changing a user role
 */
public record ChangeTeamRoleRequest(@NotNull TeamRole role) {}
