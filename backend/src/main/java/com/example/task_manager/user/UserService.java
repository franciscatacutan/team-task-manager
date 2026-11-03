package com.example.task_manager.user;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.common.PageResponse;
import com.example.task_manager.exception.api.BadRequestInputException;
import com.example.task_manager.exception.api.ConflictException;
import com.example.task_manager.exception.api.ForbiddenException;
import com.example.task_manager.exception.api.ResourceNotFoundException;
import com.example.task_manager.exception.api.UserNotFoundException;
import com.example.task_manager.user.dto.AdminResetPasswordRequest;
import com.example.task_manager.user.dto.AdminUpdateEmailRequest;
import com.example.task_manager.user.dto.AdminUpdateUserRequest;
import com.example.task_manager.user.dto.UpdateEmailRequest;
import com.example.task_manager.user.dto.UpdatePasswordRequest;
import com.example.task_manager.user.dto.UpdateUserProfileRequest;
import com.example.task_manager.user.dto.UpdateUserRoleRequest;
import com.example.task_manager.user.dto.UserResponse;
import com.example.task_manager.user.dto.UserSearchRequest;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/*
 * Service layer for managing users.
 */
@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;
  private final UserVisibilityPolicy visibility;
  private final PasswordEncoder passwordEncoder;
  private final RefreshTokenService refreshTokenService;

  /*
   * Fetch all users.
   */
  @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
  @Transactional(readOnly = true)
  public PageResponse<UserResponse> getAllUsers(UserSearchRequest request, Pageable pageable) {

    Specification<UserEntity> spec = UserSpecification.build(request.search(), request.roles());

    pageable = validateSorting(pageable);

    Page<UserEntity> page = userRepository.findAll(spec, pageable);

    return new PageResponse<>(
        page.map(this::mapToResponse).getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.isFirst(),
        page.isLast());
  }

  /*
   * Fetch one user.
   */
  @Transactional(readOnly = true)
  public UserResponse getUser(UUID userId, String requesterEmail) {
    UserEntity requester = getUserByEmail(requesterEmail);
    UserEntity user = userRepository.findById(userId).orElseThrow(UserNotFoundException::new);
    visibility.requireProfileAccess(requester, user);
    return visibility.toResponse(user, requester);
  }

  /** One admin transaction for profile, optional login email and optional global role. */
  @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
  @Transactional
  public UserResponse updateUserByAdmin(
      UUID userId, AdminUpdateUserRequest request, String requesterEmail) {
    UserEntity target =
        userRepository.findByIdForUpdate(userId).orElseThrow(UserNotFoundException::new);
    UserEntity requester = getUserByEmail(requesterEmail);
    assertCanManageTargetUser(requester, target);

    // Validate every requested operation before changing any managed state.
    String firstName =
        request.firstName() == null
            ? target.getFirstName()
            : cleanRequiredName(request.firstName(), "First name");
    String lastName =
        request.lastName() == null
            ? target.getLastName()
            : cleanRequiredName(request.lastName(), "Last name");
    String email = target.getEmail();
    if (request.email() != null) {
      if (requester.getId().equals(userId))
        throw new ForbiddenException("Use the regular email change flow for your own account.");
      if (request.email().isBlank()) throw new BadRequestInputException("Email cannot be blank");
      email = normalizeEmail(request.email());
      if (!email.equalsIgnoreCase(target.getEmail())
          && userRepository.existsByEmailIgnoreCase(email)) {
        throw new ConflictException("Email already exists");
      }
    }
    if (request.role() != null) {
      if (requester.getRole() != UserRole.SUPER_ADMIN)
        throw new ForbiddenException("Only SUPER_ADMIN can update global roles.");
      if (requester.getId().equals(userId) && request.role() != UserRole.SUPER_ADMIN) {
        throw new ForbiddenException("SUPER ADMIN cannot demote themselves.");
      }
    }

    boolean emailChanged = !email.equalsIgnoreCase(target.getEmail());
    try {
      target.setFirstName(firstName);
      target.setLastName(lastName);
      if (request.role() != null) target.setRole(request.role());
      if (emailChanged) {
        target.setEmail(email);
        // This call can auto-flush the changed email before querying sessions.
        refreshTokenService.revokeAllForUser(userId);
      }
      userRepository.flush();
    } catch (DataIntegrityViolationException conflict) {
      throw new ConflictException(
          "The user could not be saved because an account value is already in use.");
    }
    return mapToResponse(target);
  }

  /*
   * Update role for users.
   * Only SUPER_ADMIN can update roles.
   */
  @PreAuthorize("hasRole('SUPER_ADMIN')")
  @Transactional
  public void updateUserRole(UUID targetUserId, UpdateUserRoleRequest request, String requester) {

    UserEntity currentUser =
        userRepository
            .findByEmailIgnoreCase(normalizeEmail(requester))
            .orElseThrow(UserNotFoundException::new);

    UserEntity targetUser =
        userRepository.findByIdForUpdate(targetUserId).orElseThrow(UserNotFoundException::new);

    if (currentUser.getId().equals(targetUserId) && request.role() != UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("SUPER ADMIN cannot demote themselves.");
    }

    targetUser.setRole(request.role());
  }

  /*
   * Update profile names for users.
   * Login email changes use dedicated email endpoints because they affect tokens.
   */
  @PreAuthorize("#userId == authentication.principal.id or hasAnyRole('ADMIN', 'SUPER_ADMIN')")
  @Transactional
  public UserResponse updateProfile(
      UUID userId, UpdateUserProfileRequest request, String requesterEmail) {

    UserEntity requester = getUserByEmail(requesterEmail);
    UserEntity user =
        userRepository
            .findByIdForUpdate(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

    assertCanManageTargetUser(requester, user);

    if (request.firstName() != null) {
      user.setFirstName(cleanRequiredName(request.firstName(), "First name"));
    }

    if (request.lastName() != null) {
      user.setLastName(cleanRequiredName(request.lastName(), "Last name"));
    }

    return mapToResponse(user);
  }

  /*
   * Update the current user's login email.
   * This requires the current password and revokes all sessions because JWT
   * subjects are email-based.
   */
  @Transactional
  public void updateOwnEmail(UpdateEmailRequest request, String requesterEmail) {

    UserEntity user = getUserByEmailForUpdate(requesterEmail);

    if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
      throw new BadRequestInputException("Current password incorrect");
    }

    String normalizedEmail = normalizeEmail(request.newEmail());
    if (normalizedEmail.equalsIgnoreCase(user.getEmail())) {
      return;
    }

    if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw new ConflictException("Email already exists");
    }

    user.setEmail(normalizedEmail);
    refreshTokenService.revokeAllForUser(user.getId());
  }

  /*
   * Update the current user's password.
   */
  @PreAuthorize("#userId == authentication.principal.id")
  @Transactional
  public void updatePassword(UUID userId, UpdatePasswordRequest request, String requesterEmail) {

    UserEntity requester = getUserByEmailForUpdate(requesterEmail);
    UserEntity target =
        userRepository
            .findByIdForUpdate(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

    if (!requester.getId().equals(target.getId())) {
      throw new ForbiddenException("Use the admin password reset flow for another user.");
    }

    if (!passwordEncoder.matches(request.currentPassword(), target.getPassword())) {
      throw new BadRequestInputException("Current password incorrect");
    }

    target.setPassword(passwordEncoder.encode(request.newPassword()));
    refreshTokenService.revokeAllForUser(target.getId());
  }

  /*
   * Reset password for users
   * Admin and Super Admin can reset another user's password
   */
  @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
  @Transactional
  public void resetPasswordByAdmin(
      UUID targetUserId, AdminResetPasswordRequest request, String requesterEmail) {

    UserEntity requester = getUserByEmail(requesterEmail);
    UserEntity target =
        userRepository
            .findByIdForUpdate(targetUserId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

    if (requester.getId().equals(target.getId())) {
      throw new ForbiddenException("Use the regular password change flow for your own account.");
    }

    assertCanManageTargetUser(requester, target);

    target.setPassword(passwordEncoder.encode(request.newPassword()));
    refreshTokenService.revokeAllForUser(target.getId());
  }

  /*
   * Update another user's login email.
   * Admin email changes revoke sessions because JWT subjects are email-based.
   */
  @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
  @Transactional
  public UserResponse updateEmailByAdmin(
      UUID targetUserId, AdminUpdateEmailRequest request, String requesterEmail) {

    UserEntity requester = getUserByEmail(requesterEmail);
    UserEntity target =
        userRepository
            .findByIdForUpdate(targetUserId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));

    if (requester.getId().equals(target.getId())) {
      throw new ForbiddenException("Use the regular email change flow for your own account.");
    }

    assertCanManageTargetUser(requester, target);

    String normalizedEmail = normalizeEmail(request.email());
    if (normalizedEmail.equalsIgnoreCase(target.getEmail())) {
      return mapToResponse(target);
    }

    if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
      throw new ConflictException("Email already exists");
    }

    target.setEmail(normalizedEmail);
    refreshTokenService.revokeAllForUser(target.getId());

    return mapToResponse(target);
  }

  public UserResponse getByEmail(String email) {
    UserEntity user = getUserByEmail(email);

    return mapToResponse(user);
  }

  private UserEntity getUserByEmailForUpdate(String email) {
    return userRepository
        .findByEmailForUpdate(normalizeEmail(email))
        .orElseThrow(UserNotFoundException::new);
  }

  private UserEntity getUserByEmail(String email) {
    return userRepository
        .findByEmailIgnoreCase(normalizeEmail(email))
        .orElseThrow(UserNotFoundException::new);
  }

  private void assertCanManageTargetUser(UserEntity requester, UserEntity target) {
    if (Objects.equals(requester.getId(), target.getId())) {
      return;
    }

    if (requester.getRole() == UserRole.SUPER_ADMIN) {
      return;
    }

    if (requester.getRole() == UserRole.ADMIN) {
      if (target.getRole() == UserRole.SUPER_ADMIN) {
        throw new ForbiddenException("ADMIN cannot manage SUPER_ADMIN accounts.");
      }
      return;
    }

    throw new ForbiddenException("You do not have permission to manage this user.");
  }

  private String cleanRequiredName(String value, String fieldName) {
    if (value.isBlank()) {
      throw new BadRequestInputException(fieldName + " cannot be blank");
    }
    return value.trim();
  }

  private UserResponse mapToResponse(UserEntity user) {
    return new UserResponse(
        user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getRole());
  }

  private String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  /*
   * Allowed Sorting Fields
   */
  private static final Set<String> ALLOWED_SORT_FIELDS =
      Set.of("firstName", "email", "lastName", "createdAt", "updatedAt", "role");

  /*
   * Check sort request
   */
  private Pageable validateSorting(Pageable pageable) {

    for (Sort.Order order : pageable.getSort()) {
      if (!ALLOWED_SORT_FIELDS.contains(order.getProperty())) {
        throw new BadRequestInputException("Invalid sort field: " + order.getProperty());
      }
    }

    return pageable;
  }
}
