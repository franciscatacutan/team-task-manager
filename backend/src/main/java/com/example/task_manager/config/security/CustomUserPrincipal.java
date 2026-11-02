package com.example.task_manager.config.security;

import com.example.task_manager.user.entity.UserEntity;
import com.example.task_manager.user.entity.UserRole;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Represents the authenticated user within the security context.
 *
 * <p>This class decouples the persistence layer (UserEntity) from the security layer.
 */
public class CustomUserPrincipal implements UserDetails {

  private final UUID id;
  private final String firstName;
  private final String lastName;
  private final String email;
  private final String password;
  private final UserRole role;

  public CustomUserPrincipal(UserEntity user) {
    this.id = user.getId();
    this.firstName = user.getFirstName();
    this.lastName = user.getLastName();
    this.email = user.getEmail();
    this.password = user.getPassword();
    this.role = user.getRole();
  }

  public UUID getId() {
    return id;
  }

  public UserRole getRole() {
    return role;
  }

  public String getFirstName() {
    return firstName;
  }

  public String getLastName() {
    return lastName;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
  }

  @Override
  public String getUsername() {
    return email;
  }

  @Override
  public String getPassword() {
    return password;
  }

  @Override
  public boolean isAccountNonExpired() {
    return true;
  }

  @Override
  public boolean isAccountNonLocked() {
    return true;
  }

  @Override
  public boolean isCredentialsNonExpired() {
    return true;
  }

  @Override
  public boolean isEnabled() {
    return true;
  }
}
