package com.example.task_manager.exception;

import com.example.task_manager.exception.ErrorResponse.ErrorCode;
import com.example.task_manager.exception.api.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Global exception handler for the application. */
@RestControllerAdvice
public class GlobalExceptionHandler {
  private ResponseEntity<ErrorResponse> build(
      HttpStatus status,
      ErrorResponse.ErrorCode errorCode,
      String message,
      HttpServletRequest request) {
    return ResponseEntity.status(status)
        .body(
            new ErrorResponse(
                status.value(), errorCode, message, request.getRequestURI(), Instant.now()));
  }

  /** Handle all API exceptions. */
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ErrorResponse> handleApiException(
      ApiException ex, HttpServletRequest request) {
    return build(ex.getStatus(), ex.getErrorCode(), ex.getMessage(), request);
  }

  /** Handles authentication exceptions. */
  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<ErrorResponse> handleAuthenticationException(
      AuthenticationException ex, HttpServletRequest request) {
    return build(
        HttpStatus.UNAUTHORIZED, ErrorResponse.ErrorCode.UNAUTHORIZED, ex.getMessage(), request);
  }

  /** Handles validation exceptions. */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidationException(
      MethodArgumentNotValidException ex, HttpServletRequest request) {
    String message =
        ex.getBindingResult().getFieldErrors().stream()
            .map(err -> err.getField() + ": " + err.getDefaultMessage())
            .collect(Collectors.joining(", "));

    return build(
        HttpStatus.BAD_REQUEST, ErrorResponse.ErrorCode.VALIDATION_ERROR, message, request);
  }

  /** Handles empty or malformed request body exceptions. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleEmptyOrInvalidBody(
      HttpMessageNotReadableException ex, HttpServletRequest request) {

    return build(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_REQUEST,
        "Request body is missing or malformed",
        request);
  }

  /** Handles optimistic locking exceptions. */
  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  public ResponseEntity<ErrorResponse> handleOptimisticLock(
      ObjectOptimisticLockingFailureException ex, HttpServletRequest request) {

    return build(
        HttpStatus.CONFLICT,
        ErrorCode.CONFLICT,
        "Resource was modified by another user. Please refresh and try again.",
        request);
  }
}
