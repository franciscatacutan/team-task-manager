package com.example.task_manager.user;

import com.example.task_manager.user.dto.AdminResetPasswordRequest;
import com.example.task_manager.user.dto.AdminUpdateEmailRequest;
import com.example.task_manager.user.dto.UpdateUserRoleRequest;
import com.example.task_manager.user.dto.UserResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Administrative endpoints for managing users. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

  private final UserService userService;

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
