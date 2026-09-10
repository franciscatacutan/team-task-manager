package com.example.task_manager.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO for register request
 */
public record RegisterRequest(
    @NotBlank @Pattern(regexp = "^[^@]+@[^@]+\\.[^@]+$", message = "Please enter a valid email address") @Email String email,

    @NotBlank @Pattern(regexp = "^[\\p{L} .'-]+$", message = "Invalid first name") String firstName,

    @NotBlank @Pattern(regexp = "^[\\p{L} .'-]+$", message = "Invalid last name") String lastName,

    @NotBlank @Size(min = 8, message = "Password should be at least 8 characters") @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-\\[\\]{};':\"\\\\|,.<>/?]).{8,}$", message = "Password must contain upper, lower, digit, and special character") String password,

    @NotBlank @Size(min = 8, message = "Password should be at least 8 characters") @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-\\[\\]{};':\"\\\\|,.<>/?]).{8,}$", message = "Password must contain upper, lower, digit, and special character") String confirmPassword) {

}