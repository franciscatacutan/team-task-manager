package com.example.task_manager.team.dto;

import java.util.UUID;

/** DTO for failed to add member of a team. */
public record FailedMember(UUID userId, String reason, String code) {}
