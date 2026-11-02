package com.example.task_manager.config.security;

import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Initializes system-level data at application startup.
 *
 * <p>Responsibilities: - Creates a bootstrap SUPER_ADMIN if one does not exist. - Ensures
 * idempotent execution. - Prevents accidental duplicate creation.
 *
 * <p>This is intended for initial system provisioning only.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

  private final UserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  @Value("${app.bootstrap-admin.email}")
  private String email;

  @Value("${app.bootstrap-admin.password}")
  private String password;

  @Override
  public void run(String... args) {

    if (!isBootstrapConfigured()) {
      log.warn("Bootstrap admin credentials not configured. Skipping admin initialization.");
      return;
    }

    if (userRepository.existsByEmail(email)) {
      log.info("Bootstrap SUPER_ADMIN already exists. Skipping creation.");
      return;
    }

    UserEntity admin = new UserEntity();
    admin.setFirstName("System");
    admin.setLastName("Administrator");
    admin.setEmail(email);
    admin.setPassword(passwordEncoder.encode(password));
    admin.setRole(UserRole.SUPER_ADMIN);

    try {
      userRepository.saveAndFlush(admin);
      log.info("Bootstrap SUPER_ADMIN account created successfully.");
    } catch (DataAccessException ex) {
      log.error(
          "Bootstrap SUPER_ADMIN creation failed. Application startup will continue, but the database schema may not yet support the SUPER_ADMIN role.",
          ex);
    }
  }

  /** Ensures bootstrap credentials are present. */
  private boolean isBootstrapConfigured() {
    return email != null && !email.isBlank() && password != null && !password.isBlank();
  }
}
