package com.example.task_manager.config.security;

import com.example.task_manager.user.UserRepository;
import com.example.task_manager.user.entity.UserEntity;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsPasswordService;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** Custom UserDetailsService implementation for loading user details from the database. */
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService, UserDetailsPasswordService {

  private final UserRepository userRepository;

  /** Loads user details by email. */
  @Override
  public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {

    UserEntity user =
        userRepository
            .findByEmailIgnoreCase(normalizeEmail(email))
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    return new CustomUserPrincipal(user);
  }

  @Override
  public UserDetails updatePassword(UserDetails user, String newPassword) {
    UserEntity persistedUser =
        userRepository
            .findByEmailIgnoreCase(normalizeEmail(user.getUsername()))
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

    persistedUser.setPassword(newPassword);
    return new CustomUserPrincipal(userRepository.save(persistedUser));
  }

  private String normalizeEmail(String email) {
    return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
  }
}
