package com.example.task_manager.config.jwt;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.security.CustomUserDetailsService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Filter for handling JWT authentication. */
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

  private final JwtService jwtService;
  private final RefreshTokenService refreshTokenService;
  private final CustomUserDetailsService userDetailsService;
  private final AuthenticationEntryPoint authenticationEntryPoint;

  /**
   * Credential/refresh endpoints validate their own credentials. Logout also handles its optional
   * bearer directly for idempotent revocation. An expired access token must not prevent refresh or
   * logout from reaching that validation.
   */
  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return request.getRequestURI().startsWith("/api/auth/");
  }

  /**
   * Processes incoming requests and validates JWT tokens. Validate the token and set authentication
   * in the security context
   */
  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {

    String authHeader = request.getHeader("Authorization");

    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = authHeader.substring(7).trim();
    if (token.isEmpty()) {
      filterChain.doFilter(request, response);
      return;
    }

    JwtService.AccessTokenClaims claims;
    try {
      claims = jwtService.parseAccessToken(token);
    } catch (JwtException | IllegalArgumentException ex) {
      SecurityContextHolder.clearContext();
      authenticationEntryPoint.commence(
          request, response, new BadCredentialsException("Invalid or expired bearer token", ex));
      return;
    }

    if (SecurityContextHolder.getContext().getAuthentication() == null) {
      UserDetails userDetails;
      try {
        userDetails = userDetailsService.loadUserByUsername(claims.email());
      } catch (UsernameNotFoundException ex) {
        SecurityContextHolder.clearContext();
        authenticationEntryPoint.commence(request, response, ex);
        return;
      }

      if (userDetails.isEnabled()
          && claims.matches(userDetails)
          && refreshTokenService.isSessionActive(claims.sessionId(), claims.userId())) {
        UsernamePasswordAuthenticationToken authToken =
            new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);
      }
    }
    filterChain.doFilter(request, response);
  }
}
