package com.example.task_manager.team.dto;

import java.util.List;
import java.util.UUID;

/** DTO for returning removed/failed team member information. */
public record RemoveTeamMembersResponse(List<UUID> success, List<FailedMember> failed) {}
