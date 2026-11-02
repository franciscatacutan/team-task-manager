package com.example.task_manager.seed.dto;

/** Response payload for generated demo data. */
public record SeedDemoDataResponse(
    String batchId,
    String sharedPassword,
    int usersCreated,
    int teamsCreated,
    int projectsCreated,
    int tasksCreated,
    int commentsCreated,
    String firstUserEmail,
    String requesterEmail) {}
