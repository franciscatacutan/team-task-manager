package com.example.task_manager.team.dto;

import com.example.task_manager.team.entity.TeamRole;
import java.util.Set;
import java.util.UUID;

/*
 * DTO for fetching teams with search, filtering and sort
 */
public record TeamMemberSearchRequest(String search, UUID memberId, Set<TeamRole> roles) {}
