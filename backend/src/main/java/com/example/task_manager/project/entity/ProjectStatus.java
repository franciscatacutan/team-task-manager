package com.example.task_manager.project.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

/** Enum representing the status of a project. */
public enum ProjectStatus {
  ACTIVE,
  ON_HOLD,
  COMPLETED,
  DELETED;

  // Converts a string to a Project Status enum, ignoring case
  @JsonCreator
  public static ProjectStatus from(String value) {
    return ProjectStatus.valueOf(value.toUpperCase());
  }
}
