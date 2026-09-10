package com.example.task_manager.auth;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.task_manager.auth.dto.AuthResponse;
import com.example.task_manager.auth.dto.LoginRequest;
import com.example.task_manager.auth.dto.RegisterRequest;
import com.example.task_manager.auth.dto.AuthResponse.User;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.exception.api.AuthException;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.exception.api.EmailAlreadyInUseException;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;

import lombok.RequiredArgsConstructor;

/**
 * Contains business logic for managing authentication.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final AuthenticationManager authenticationManager;
  private final JwtService jwtService;
  private final RefreshTokenService refreshTokenService;

  @Transactional
  public AuthSession register(RegisterRequest request, String ipAddress, String userAgent) {
    String normalizedEmail = normalizeEmail(request.email());

    if (!request.password().equals(request.confirmPassword())) {
      throw new BadRequestInputException("Passwords do not match");
    }

    if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw new EmailAlreadyInUseException();
    }

    UserEntity user = new UserEntity();
    user.setFirstName(request.firstName().trim());
    user.setLastName(request.lastName().trim());
    user.setEmail(normalizedEmail);
    user.setRole(UserRole.USER);
    user.setPassword(passwordEncoder.encode(request.password()));

    try {
      user = userRepository.save(user);
    } catch (DataIntegrityViolationException ex) {
      throw new EmailAlreadyInUseException();
    }

    RefreshTokenService.RefreshTokenSession refreshTokenSession = refreshTokenService.createSession(user, ipAddress,
        userAgent);
    return new AuthSession(buildAuthResponse(user), refreshTokenSession.token());
  }

  @Transactional
  public AuthSession login(LoginRequest request, String ipAddress, String userAgent) {
    String normalizedEmail = normalizeEmail(request.email());

    try {
      var authentication = authenticationManager.authenticate(
          UsernamePasswordAuthenticationToken.unauthenticated(normalizedEmail, request.password()));

      CustomUserPrincipal principal = (CustomUserPrincipal) authentication.getPrincipal();
      UserEntity user = userRepository.findById(principal.getId())
          .orElseThrow(AuthException::new);

      RefreshTokenService.RefreshTokenSession refreshTokenSession = refreshTokenService.createSession(user, ipAddress,
          userAgent);
      return new AuthSession(buildAuthResponse(user), refreshTokenSession.token());
    } catch (AuthenticationException ex) {
      throw new AuthException();
    }
  }

  @Transactional
  public AuthSession refresh(String rawRefreshToken, String ipAddress, String userAgent) {
    RefreshTokenService.RefreshTokenSession refreshTokenSession = refreshTokenService.rotate(
        rawRefreshToken,
        ipAddress,
        userAgent);
    UserEntity user = refreshTokenService.getUserForRefreshToken(refreshTokenSession.token());
    return new AuthSession(buildAuthResponse(user), refreshTokenSession.token());
  }

  @Transactional
  public void logout(String rawRefreshToken) {
    refreshTokenService.revoke(rawRefreshToken);
  }

  private User buildUserDetails(UserEntity user) {
    return new User(
        user.getId(),
        user.getFirstName(),
        user.getLastName(),
        user.getEmail(),
        user.getRole());
  }

  private AuthResponse buildAuthResponse(UserEntity user) {
    return new AuthResponse(
        jwtService.generateToken(user),
        jwtService.getAccessTokenExpirationSeconds(),
        buildUserDetails(user));
  }

  private String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  public record AuthSession(AuthResponse response, String refreshToken) {
  }
}
