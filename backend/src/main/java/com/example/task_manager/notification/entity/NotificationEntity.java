package com.example.task_manager.notification.entity;

import com.example.task_manager.activity.entity.ActivityEventEntity;
import com.example.task_manager.user.entity.UserEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Setter
@Entity
@Table(
    name = "notifications",
    indexes = {
      @Index(name = "idx_notification_recipient_created", columnList = "recipient_id, created_at"),
      @Index(name = "idx_notification_recipient_read", columnList = "recipient_id, read_at")
    })
@EntityListeners(AuditingEntityListener.class)
public class NotificationEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "recipient_id", nullable = false)
  private UserEntity recipient;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "actor_id")
  private UserEntity actor;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "activity_event_id")
  private ActivityEventEntity activityEvent;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private NotificationType type;

  @Column(nullable = false, length = 120)
  private String title;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String body;

  @Column(nullable = false, length = 255)
  private String targetPath;

  @Column(name = "team_id")
  private UUID teamId;

  @Column(name = "project_id")
  private UUID projectId;

  @Column(name = "task_id")
  private UUID taskId;

  private Instant readAt;

  @CreatedDate
  @Column(nullable = false, updatable = false)
  private Instant createdAt;
}
