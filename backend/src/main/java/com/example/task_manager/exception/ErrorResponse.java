package com.example.task_manager.exception;

import java.time.Instant;

/** Represents an error response structure. */
public record ErrorResponse(
    int status, ErrorCode error, String message, String path, Instant timestamp) {

  public enum ErrorCode {
    INVALID_CREDENTIALS,
    FORBIDDEN,
    UNAUTHORIZED,
    EMAIL_ALREADY_EXISTS,
    NOT_FOUND,
    INVALID_REQUEST,
    INTERNAL_SERVER_ERROR,
    VALIDATION_ERROR,
    INVALID_PARAMETER,
    INVALID_METHOD,
    CONFLICT,
    BAD_REQUEST
  }
}
