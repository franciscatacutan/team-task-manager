package com.example.task_manager.observability.entity;

/** High-level action categories used by audit consumers and analytics. */
public enum AuditAction {
  CREATE,
  UPDATE,
  DELETE,
  STATUS_CHANGE,
  ASSIGNMENT_CHANGE,
  COMMENT,
  MEMBERSHIP_CHANGE,
  OWNERSHIP_TRANSFER,
  SYSTEM
}
