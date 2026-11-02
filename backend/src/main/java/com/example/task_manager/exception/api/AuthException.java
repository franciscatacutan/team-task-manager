package com.example.task_manager.exception.api;

import com.example.task_manager.exception.ErrorResponse.ErrorCode;
import org.springframework.http.HttpStatus;

/** Thrown when authentication fails. */
public class AuthException extends ApiException {
  public AuthException() {
    super(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, "Invalid Credentials");
  }
}
