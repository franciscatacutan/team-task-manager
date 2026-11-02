package com.example.task_manager.config.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.lang.reflect.Field;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class DataInitializerTest {

  @Mock private UserRepository userRepository;

  @Mock private PasswordEncoder passwordEncoder;

  @InjectMocks private DataInitializer dataInitializer;

  @Test
  void shouldSkipBootstrapCreationWhenCredentialsAreMissing() throws Exception {
    setField("email", "");
    setField("password", "");

    dataInitializer.run();

    verify(userRepository, never()).existsByEmail(any());
    verify(userRepository, never()).saveAndFlush(any(UserEntity.class));
  }

  @Test
  void shouldContinueWhenBootstrapSuperAdminCreationFails() throws Exception {
    setField("email", "admin@example.com");
    setField("password", "Secret123!");

    when(userRepository.existsByEmail("admin@example.com")).thenReturn(false);
    when(passwordEncoder.encode("Secret123!")).thenReturn("encoded-secret");
    when(userRepository.saveAndFlush(any(UserEntity.class)))
        .thenThrow(new DataIntegrityViolationException("unsupported role"));

    dataInitializer.run();

    verify(userRepository).saveAndFlush(any(UserEntity.class));
  }

  private void setField(String fieldName, String value) throws Exception {
    Field field = DataInitializer.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(dataInitializer, value);
  }
}
