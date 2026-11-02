package com.example.task_manager.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.web.util.WebUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes and clears the refresh token cookie.
 */
@Service
public class RefreshTokenCookieService implements InitializingBean {

  private final String cookieName;
  private final boolean secureCookie;
  private final String sameSite;
  private final long refreshTokenExpirationMs;

  public RefreshTokenCookieService(
      @Value("${auth.refresh-cookie-name}") String cookieName,
      @Value("${auth.refresh-cookie-secure}") boolean secureCookie,
      @Value("${auth.refresh-cookie-same-site}") String sameSite,
      @Value("${auth.refresh-token-expiration-ms}") long refreshTokenExpirationMs) {
    this.cookieName = cookieName;
    this.secureCookie = secureCookie;
    this.sameSite = sameSite;
    this.refreshTokenExpirationMs = refreshTokenExpirationMs;
  }

  public void writeRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
    ResponseCookie cookie = ResponseCookie.from(cookieName, refreshToken)
        .httpOnly(true)
        .secure(secureCookie)
        .sameSite(sameSite)
        .path("/api/auth")
        .maxAge(refreshTokenExpirationMs / 1000)
        .build();

    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  public void clearRefreshTokenCookie(HttpServletResponse response) {
    ResponseCookie cookie = ResponseCookie.from(cookieName, "")
        .httpOnly(true)
        .secure(secureCookie)
        .sameSite(sameSite)
        .path("/api/auth")
        .maxAge(0)
        .build();

    response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
  }

  public String extractRefreshToken(HttpServletRequest request) {
    var cookie = WebUtils.getCookie(request, cookieName);
    return cookie == null ? null : cookie.getValue();
  }

  @Override
  public void afterPropertiesSet() {
    if (cookieName == null || cookieName.isBlank()) {
      throw new IllegalStateException("Refresh-cookie name must be configured");
    }
    if (!"Lax".equals(sameSite) && !"Strict".equals(sameSite) && !"None".equals(sameSite)) {
      throw new IllegalStateException("Refresh-cookie SameSite must be Lax, Strict, or None");
    }
    if ("None".equals(sameSite) && !secureCookie) {
      throw new IllegalStateException("SameSite=None refresh cookies must be Secure");
    }
    if (refreshTokenExpirationMs <= 0) {
      throw new IllegalStateException("Refresh-token expiration must be positive");
    }
  }
}
