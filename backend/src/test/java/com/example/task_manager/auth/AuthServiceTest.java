package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.example.task_manager.auth.dto.AuthResponse;
import com.example.task_manager.auth.dto.LoginRequest;
import com.example.task_manager.auth.dto.RegisterRequest;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.config.security.CustomUserPrincipal;
import com.example.task_manager.exception.api.EmailAlreadyInUseException;
import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;

/**
 * Unit tests for AuthService.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

  // Mocked dependencies
  @Mock
  private UserRepository userRepository;

  @Mock
  private PasswordEncoder passwordEncoder;

  @Mock
  private AuthenticationManager authenticationManager;

  @Mock
  private JwtService jwtService;

  @Mock
  private RefreshTokenService refreshTokenService;

  @InjectMocks
  private AuthService authService;

  /**
   * Tests successful user registration.
   */
  @Test
  void shouldRegisterUserSuccessfully() {

    // Data for registration
    String email = "test@test.com";
    String password = "password123";

    RegisterRequest request = new RegisterRequest(
        email,
        "Test",
        "Name",
        password,
        password);

    when(userRepository.existsByEmailIgnoreCase(email))
        .thenReturn(false);

    when(passwordEncoder.encode(password))
        .thenReturn("hashed-pass");

    when(userRepository.save(any(UserEntity.class)))
        .thenAnswer(invocation -> {
          UserEntity savedUser = invocation.getArgument(0);
          savedUser.setId(UUID.randomUUID());
          return savedUser;
        });

    when(jwtService.generateToken(any(UserEntity.class)))
        .thenReturn("fake-jwt-token");
    when(jwtService.getAccessTokenExpirationSeconds()).thenReturn(900L);
    when(refreshTokenService.createSession(any(UserEntity.class), any(), any()))
        .thenReturn(
            new RefreshTokenService.RefreshTokenSession("refresh-token", java.time.Instant.now().plusSeconds(3600)));

    AuthService.AuthSession session = authService.register(request, "127.0.0.1", "JUnit");
    AuthResponse response = session.response();

    // Verify interactions and response
    verify(passwordEncoder).encode("password123");
    verify(userRepository).save(any(UserEntity.class));
    verify(userRepository).existsByEmailIgnoreCase("test@test.com");
    // Verify that the token was generated
    assertThat(response.token()).isEqualTo("fake-jwt-token");
    assertThat(response.user().email()).isEqualTo("test@test.com");

  }

  /**
   * Tests registration failure when email is already in use.
   */
  @Test
  void shouldThrowExceptionWhenEmailAlreadyExists() {

    // Existing email
    String email = "john@test.com";

    RegisterRequest request = new RegisterRequest(
        email,
        "John",
        "Doe",
        "password123",
        "password123");

    when(userRepository.existsByEmailIgnoreCase(email))
        .thenReturn(true);

    // Assert that EmailAlreadyInUseException is thrown
    assertThrows(EmailAlreadyInUseException.class,
        () -> authService.register(request, "127.0.0.1", "JUnit"));
  }

  @Test
  void shouldLoginUsingAuthenticationManager() {

    UserEntity user = new UserEntity();
    UUID userId = UUID.randomUUID();
    user.setId(userId);
    user.setFirstName("Jane");
    user.setLastName("Doe");
    user.setEmail("jane@test.com");
    user.setPassword("{argon2}hashed");
    user.setRole(UserRole.USER);

    CustomUserPrincipal principal = new CustomUserPrincipal(user);
    LoginRequest request = new LoginRequest("  JANE@test.com ", "Password123!");

    when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
        .thenReturn(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()));
    when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    when(jwtService.generateToken(user)).thenReturn("jwt-token");
    when(jwtService.getAccessTokenExpirationSeconds()).thenReturn(900L);
    when(refreshTokenService.createSession(any(UserEntity.class), any(), any()))
        .thenReturn(
            new RefreshTokenService.RefreshTokenSession("refresh-token", java.time.Instant.now().plusSeconds(3600)));

    AuthService.AuthSession session = authService.login(request, "127.0.0.1", "JUnit");
    AuthResponse response = session.response();

    verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    verify(userRepository).findById(eq(userId));
    assertThat(response.token()).isEqualTo("jwt-token");
    assertThat(response.user().email()).isEqualTo("jane@test.com");
  }
}
