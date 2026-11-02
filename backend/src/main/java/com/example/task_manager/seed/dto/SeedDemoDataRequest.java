package com.example.task_manager.seed.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Request payload for generating demo data. */
public record SeedDemoDataRequest(@Min(1) @Max(500) int count) {}
