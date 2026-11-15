package com.example.task_manager.exception.api;

import com.example.task_manager.exception.ErrorResponse;
import org.springframework.http.HttpStatus;

/** Base class for API exceptions. */
public abstract class ApiException extends RuntimeException {

  private final HttpStatus status;
  private final ErrorResponse.ErrorCode errorCode;

  protected ApiException(HttpStatus status, ErrorResponse.ErrorCode errorCode, String message) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }

  public HttpStatus getStatus() {
    return status;
  }

  public ErrorResponse.ErrorCode getErrorCode() {
    return errorCode;
  }
}
