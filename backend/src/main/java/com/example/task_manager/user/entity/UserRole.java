package com.example.task_manager.user.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

/** Enum representing the role of a user. */
public enum UserRole {
  USER,
  ADMIN,
  SUPER_ADMIN;

  // Converts a string to a User Role enum, ignoring case
  @JsonCreator
  public static UserRole from(String value) {
    return UserRole.valueOf(value.toUpperCase());
  }
}
