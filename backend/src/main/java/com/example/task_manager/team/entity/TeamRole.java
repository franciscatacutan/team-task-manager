package com.example.task_manager.team.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

/** Enum representing the role of a team member. */
public enum TeamRole {
  OWNER,
  ADMIN,
  MEMBER;

  // Converts a string to a Team Role enum, ignoring case
  @JsonCreator
  public static TeamRole from(String value) {
    return TeamRole.valueOf(value.toUpperCase());
  }
}
