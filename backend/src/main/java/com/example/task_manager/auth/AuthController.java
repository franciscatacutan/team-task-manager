package com.example.task_manager.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.task_manager.auth.dto.*;
import com.example.task_manager.exception.api.AuthException;

import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.*;

/**
 * Handles Authentication operations.
 */

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;
  private final RefreshTokenCookieService refreshTokenCookieService;

  /**
   * Registers a new user.
   */
  @PostMapping("/register")
  public ResponseEntity<AuthResponse> register(
      @Valid @RequestBody RegisterRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    AuthService.AuthSession session = authService.register(request, extractClientIp(httpRequest),
        httpRequest.getHeader("User-Agent"));
    refreshTokenCookieService.writeRefreshTokenCookie(httpResponse, session.refreshToken());
    return ResponseEntity.status(HttpStatus.CREATED).body(session.response());
  }

  /**
   * Logs in an existing user.
   */
  @PostMapping("/login")
  public ResponseEntity<AuthResponse> login(
      @Valid @RequestBody LoginRequest request,
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    AuthService.AuthSession session = authService.login(request, extractClientIp(httpRequest),
        httpRequest.getHeader("User-Agent"));
    refreshTokenCookieService.writeRefreshTokenCookie(httpResponse, session.refreshToken());
    return ResponseEntity.ok(session.response());
  }

  @PostMapping("/refresh")
  public ResponseEntity<AuthResponse> refresh(
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    String refreshToken = refreshTokenCookieService.extractRefreshToken(httpRequest);
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new AuthException();
    }

    AuthService.AuthSession session = authService.refresh(
        refreshToken,
        extractClientIp(httpRequest),
        httpRequest.getHeader("User-Agent"));
    refreshTokenCookieService.writeRefreshTokenCookie(httpResponse, session.refreshToken());
    return ResponseEntity.ok(session.response());
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      HttpServletRequest httpRequest,
      HttpServletResponse httpResponse) {
    authService.logout(refreshTokenCookieService.extractRefreshToken(httpRequest));
    refreshTokenCookieService.clearRefreshTokenCookie(httpResponse);
    return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
  }

  private String extractClientIp(HttpServletRequest request) {
    String forwardedFor = request.getHeader("X-Forwarded-For");
    if (forwardedFor == null || forwardedFor.isBlank()) {
      return request.getRemoteAddr();
    }
    return forwardedFor.split(",")[0].trim();
  }
}
