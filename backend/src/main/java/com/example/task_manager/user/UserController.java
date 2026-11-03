package com.example.task_manager.user;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.user.dto.UpdateEmailRequest;
import com.example.task_manager.user.dto.UpdatePasswordRequest;
import com.example.task_manager.user.dto.UpdateUserProfileRequest;
import com.example.task_manager.user.dto.UserResponse;
import com.example.task_manager.user.dto.UserSearchRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * REST controller for managing users.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;

  /*
   * Get All Active Users
   */
  @GetMapping
  public ResponseEntity<PageResponse<UserResponse>> getAllUsers(
      UserSearchRequest request, Pageable pageable) {
    return ResponseEntity.ok(userService.getAllUsers(request, pageable));
  }

  /*
   * Get Active User
   */
  @GetMapping("/{userId}")
  public ResponseEntity<UserResponse> getUser(
      @PathVariable UUID userId, Authentication authentication) {
    return ResponseEntity.ok(userService.getUser(userId, authentication.getName()));
  }

  /*
   * Update current user's login email
   */
  @PatchMapping("/me/email")
  public ResponseEntity<Void> updateCurrentUserEmail(
      Authentication authentication, @Valid @RequestBody UpdateEmailRequest request) {
    userService.updateOwnEmail(request, authentication.getName());
    return ResponseEntity.noContent().build();
  }

  /*
   * Update User Details
   */
  @PatchMapping("/{userId}")
  public ResponseEntity<UserResponse> updateUserDetails(
      @PathVariable UUID userId,
      Authentication authentication,
      @Valid @RequestBody UpdateUserProfileRequest request) {
    return ResponseEntity.ok(userService.updateProfile(userId, request, authentication.getName()));
  }

  /*
   * Update User Password
   */
  @PatchMapping("/{userId}/password")
  public ResponseEntity<Void> updateUserPassword(
      @PathVariable UUID userId,
      Authentication authentication,
      @Valid @RequestBody UpdatePasswordRequest request) {
    userService.updatePassword(userId, request, authentication.getName());
    return ResponseEntity.noContent().build();
  }

  /*
   * Get Active User's Details
   */
  @GetMapping("/me")
  public ResponseEntity<UserResponse> getCurrentUser(Authentication authentication) {
    return ResponseEntity.ok(userService.getByEmail(authentication.getName()));
  }
}
