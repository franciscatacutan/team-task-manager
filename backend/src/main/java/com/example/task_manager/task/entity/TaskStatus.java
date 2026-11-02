package com.example.task_manager.task.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

/** Enum representing the status of a task. */
public enum TaskStatus {
  TODO,
  IN_PROGRESS,
  IN_REVIEW,
  ON_HOLD,
  DONE,
  CANCELLED,
  DELETED;

  /** Allowed user transitions; deletion uses the dedicated archive operation. */
  public boolean canTransitionTo(TaskStatus next) {
    if (next == null || next == this || next == TODO || next == DELETED) {
      return false;
    }
    return switch (this) {
      case TODO, IN_PROGRESS, IN_REVIEW, ON_HOLD -> true;
      case DONE -> next == IN_REVIEW || next == ON_HOLD;
      case CANCELLED, DELETED -> false;
    };
  }

  // Converts a string to a TaskStatus enum, ignoring case
  @JsonCreator
  public static TaskStatus from(String value) {
    return TaskStatus.valueOf(value.toUpperCase());
  }
}
