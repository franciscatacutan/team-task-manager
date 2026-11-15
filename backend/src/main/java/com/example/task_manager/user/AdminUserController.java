package com.example.task_manager.user;

import com.example.task_manager.user.dto.AdminResetPasswordRequest;
import com.example.task_manager.user.dto.AdminUpdateEmailRequest;
import com.example.task_manager.user.dto.AdminUpdateUserRequest;
import com.example.task_manager.user.dto.UpdateUserRoleRequest;
import com.example.task_manager.user.dto.UserAccessReview;
import com.example.task_manager.user.dto.UserAccessReview.RestoreRequest;
import com.example.task_manager.user.dto.UserResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Administrative endpoints for managing users. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

  private final UserService userService;
  private final UserLifecycleService lifecycle;

  @GetMapping("/{id}/access-review")
  public UserAccessReview review(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      Authentication authentication) {
    return lifecycle.review(id, authentication.getName(), page);
  }

  @PatchMapping("/{id}/archive")
  public UserResponse archive(@PathVariable UUID id, Authentication authentication) {
    return lifecycle.archive(id, authentication.getName());
  }

  @PatchMapping("/{id}/restore")
  public UserResponse restore(
      @PathVariable UUID id,
      @Valid @RequestBody RestoreRequest request,
      Authentication authentication) {
    return lifecycle.restore(id, authentication.getName(), request);
  }

  /**
   * Updates the role of a specific user.
   *
   * <p>Only SUPER_ADMIN is allowed to perform this operation.
   */
  @PatchMapping("/{id}/role")
  public ResponseEntity<Void> updateUserRole(
      @PathVariable UUID id,
      @Valid @RequestBody UpdateUserRoleRequest request,
      Authentication authentication) {

    userService.updateUserRole(id, request, authentication.getName());

    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/{id}")
  public ResponseEntity<UserResponse> updateUser(
      @PathVariable UUID id,
      @Valid @RequestBody AdminUpdateUserRequest request,
      Authentication authentication) {
    return ResponseEntity.ok(userService.updateUserByAdmin(id, request, authentication.getName()));
  }

  @PatchMapping("/{id}/password")
  public ResponseEntity<Void> resetUserPassword(
      @PathVariable UUID id,
      @Valid @RequestBody AdminResetPasswordRequest request,
      Authentication authentication) {

    userService.resetPasswordByAdmin(id, request, authentication.getName());

    return ResponseEntity.noContent().build();
  }

  @PatchMapping("/{id}/email")
  public ResponseEntity<UserResponse> updateUserEmail(
      @PathVariable UUID id,
      @Valid @RequestBody AdminUpdateEmailRequest request,
      Authentication authentication) {

    return ResponseEntity.ok(userService.updateEmailByAdmin(id, request, authentication.getName()));
  }
}
