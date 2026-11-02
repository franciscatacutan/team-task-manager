package com.example.task_manager.user.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Entity representing a user. */
@Getter
@Setter
@Entity
@EntityListeners(AuditingEntityListener.class) // Enable auditing for createdAt and updatedAt fields
@Table(
    name = "users",
    indexes = {
      @Index(name = "idx_user_email", columnList = "email"),
      @Index(name = "idx_user_role", columnList = "role")
    })
public class UserEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 100)
  private String firstName;

  @Column(nullable = false, length = 100)
  private String lastName;

  @Transient
  public String getFullName() {
    return firstName + " " + lastName;
  }

  @Column(nullable = false, unique = true, length = 150)
  private String email;

  @Column(nullable = false, length = 255)
  private String password;

  @CreatedDate
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(nullable = false)
  private Instant updatedAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private UserRole role;

  @Version private Long version;
}
