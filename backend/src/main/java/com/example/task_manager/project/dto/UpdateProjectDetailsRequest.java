package com.example.task_manager.project.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

/** PATCH fields for an existing project, including an explicitly cleared deadline. */
@Getter
@Setter
public class UpdateProjectDetailsRequest {
  @Size(max = 100)
  private String name;

  @Size(max = 2000)
  private String description;

  private Instant plannedStartDate;

  private String plannedDueDate;

  @Getter(AccessLevel.NONE)
  @Setter(AccessLevel.NONE)
  private boolean plannedDueDateProvided;

  @JsonSetter(value = "plannedDueDate", nulls = Nulls.SET)
  public void setPlannedDueDate(String plannedDueDate) {
    this.plannedDueDate = plannedDueDate;
    plannedDueDateProvided = true;
  }

  public boolean hasPlannedDueDate() {
    return plannedDueDateProvided;
  }
}
