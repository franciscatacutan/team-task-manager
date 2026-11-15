package com.example.task_manager.project;

import com.example.task_manager.exception.api.ConflictException;

final class ProjectCompletionConfirmationRequired extends ConflictException {
  private final long openTaskCount;

  ProjectCompletionConfirmationRequired(long openTaskCount) {
    super("Confirm project completion with open tasks.");
    this.openTaskCount = openTaskCount;
  }

  long openTaskCount() {
    return openTaskCount;
  }
}
