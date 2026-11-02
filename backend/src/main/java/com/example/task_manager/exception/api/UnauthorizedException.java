package com.example.task_manager.exception.api;

import com.example.task_manager.exception.ErrorResponse.ErrorCode;
import org.springframework.http.HttpStatus;

/** Thrown when a user is not authorized to perform an action. */
public class UnauthorizedException extends ApiException {

  private static final String DEFAULT_MESSAGE = "User is not Authorized";

  public UnauthorizedException() {
    this(null);
  }

  public UnauthorizedException(String message) {
    super(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHORIZED,
        message == null || message.isBlank() ? DEFAULT_MESSAGE : message);
  }
}
