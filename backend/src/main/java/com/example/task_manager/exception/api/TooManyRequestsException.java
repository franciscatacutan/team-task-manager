package com.example.task_manager.exception.api;

import com.example.task_manager.exception.ErrorResponse.ErrorCode;
import java.time.Duration;
import org.springframework.http.HttpStatus;

public class TooManyRequestsException extends ApiException {
  private final long retryAfterSeconds;

  public TooManyRequestsException(Duration retryAfter) {
    super(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.TOO_MANY_REQUESTS,
        "Too many attempts. Please wait before trying again.");
    retryAfterSeconds = retryAfter.getSeconds() + (retryAfter.getNano() > 0 ? 1 : 0);
  }

  public long getRetryAfterSeconds() {
    return retryAfterSeconds;
  }
}
