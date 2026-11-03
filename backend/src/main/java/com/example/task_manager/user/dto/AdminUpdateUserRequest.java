package com.example.task_manager.user.dto;

import com.example.task_manager.user.entity.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/** Partial admin edit. All supplied fields are validated and committed together. */
public record AdminUpdateUserRequest(
    @Size(max = 100) String firstName,
    @Size(max = 100) String lastName,
    @Email @Size(max = 150) String email,
    UserRole role) {
  public AdminUpdateUserRequest {
    firstName = firstName == null ? null : firstName.trim();
    lastName = lastName == null ? null : lastName.trim();
    email = email == null ? null : email.trim();
  }
}
