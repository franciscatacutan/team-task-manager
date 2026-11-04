package com.example.task_manager.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.task_manager.auth.dto.LoginRequest;
import com.example.task_manager.auth.dto.RegisterRequest;
import com.example.task_manager.user.dto.AdminResetPasswordRequest;
import com.example.task_manager.user.dto.UpdateEmailRequest;
import com.example.task_manager.user.dto.UpdatePasswordRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AccountRequestValidationTest {
  static ValidatorFactory factory;
  static Validator validator;

  @BeforeAll
  static void setup() {
    factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @AfterAll
  static void close() {
    factory.close();
  }

  @ParameterizedTest
  @ValueSource(strings = {"old", "simplepassword", " old "})
  void signInAcceptsExistingNonblankSecretsWithoutApplyingCreationRules(String password) {
    assertThat(validator.validate(new LoginRequest("person@example.test", password))).isEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest("person@example.test", "First", "Last", password, password)))
        .isNotEmpty();
  }

  @ParameterizedTest
  @ValueSource(strings = {"", " ", "\t"})
  void signInStillRejectsBlankCredentials(String password) {
    assertThat(validator.validate(new LoginRequest("person@example.test", password))).isNotEmpty();
  }

  @ParameterizedTest
  @ValueSource(strings = {"short", "abcdefgh", "PASSWORD1!", "Abcdefgh!", "Abcd1234"})
  void EveryNewPasswordFlowRetainsItsExistingComplexityRule(String password) {
    assertThat(
            validator.validate(
                new RegisterRequest("person@example.test", "First", "Last", password, password)))
        .isNotEmpty();
    assertThat(validator.validate(new UpdatePasswordRequest("old", password))).isNotEmpty();
    assertThat(validator.validate(new AdminResetPasswordRequest(password))).isNotEmpty();
  }

  @Test
  void existingCurrentPasswordsAreNotSubjectToCreationRules() {
    assertThat(validator.validate(new UpdatePasswordRequest("old", "Strong123!"))).isEmpty();
    assertThat(validator.validate(new UpdateEmailRequest("old", "person@example.test"))).isEmpty();
  }

  @Test
  void namesRespectExistingStorageBoundsAndUnicodeNameRules() {
    assertThat(
            validator.validate(
                new RegisterRequest(
                    "person@example.test", "Éva-Marie", "O'Neil", "Strong123!", "Strong123!")))
        .isEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(
                    "person@example.test",
                    "a".repeat(100),
                    "b".repeat(100),
                    "Strong123!",
                    "Strong123!")))
        .isEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(
                    "person@example.test", "a".repeat(101), "Last", "Strong123!", "Strong123!")))
        .isNotEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(
                    "person@example.test", "First", "b".repeat(101), "Strong123!", "Strong123!")))
        .isNotEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(
                    "person@example.test", "Name123", "Last", "Strong123!", "Strong123!")))
        .isNotEmpty();
  }

  @Test
  void emailsRespectTheExistingStorageLimitAcrossAccountRequests() {
    String email = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(21);
    assertThat(email).hasSize(150);
    assertThat(validator.validate(new LoginRequest(email, "old"))).isEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(email, "First", "Last", "Strong123!", "Strong123!")))
        .isEmpty();
    assertThat(validator.validate(new UpdateEmailRequest("old", email))).isEmpty();
    assertThat(validator.validate(new LoginRequest(email + "c", "old"))).isNotEmpty();
    assertThat(
            validator.validate(
                new RegisterRequest(email + "c", "First", "Last", "Strong123!", "Strong123!")))
        .isNotEmpty();
    assertThat(validator.validate(new UpdateEmailRequest("old", email + "c"))).isNotEmpty();
  }
}
