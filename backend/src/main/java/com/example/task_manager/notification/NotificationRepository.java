package com.example.task_manager.notification;

import com.example.task_manager.notification.entity.NotificationEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

  @Query(
      """
      SELECT n FROM NotificationEntity n
      JOIN n.recipient r
      WHERE LOWER(r.email) = LOWER(:recipientEmail)
        AND (:unreadOnly = false OR n.readAt IS NULL)
      """)
  Page<NotificationEntity> findInbox(String recipientEmail, boolean unreadOnly, Pageable pageable);

  @Query(
      """
      SELECT COUNT(n) FROM NotificationEntity n
      JOIN n.recipient r
      WHERE LOWER(r.email) = LOWER(:recipientEmail)
        AND n.readAt IS NULL
      """)
  long countUnread(String recipientEmail);

  @Query(
      """
      SELECT n FROM NotificationEntity n
      JOIN n.recipient r
      WHERE n.id = :notificationId
        AND LOWER(r.email) = LOWER(:recipientEmail)
      """)
  Optional<NotificationEntity> findOwned(UUID notificationId, String recipientEmail);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query(
      """
      UPDATE NotificationEntity n
      SET n.readAt = :readAt
      WHERE n.recipient.id = :recipientId
        AND n.readAt IS NULL
      """)
  int markAllRead(UUID recipientId, Instant readAt);
}
