package com.example.task_manager.notification;

import com.example.task_manager.notification.entity.NotificationEntity;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<NotificationEntity, UUID> {

  @EntityGraph(
      attributePaths = {
        "actor",
        "activityEvent",
        "activityEvent.task",
        "activityEvent.task.project",
        "activityEvent.task.project.team"
      })
  @Query(
      """
      SELECT n FROM NotificationEntity n
      WHERE n.recipient.id = :recipientId
        AND (:unreadOnly = false OR n.readAt IS NULL)
      """)
  Page<NotificationEntity> findInbox(UUID recipientId, boolean unreadOnly, Pageable pageable);

  @Query(
      """
      SELECT COUNT(n) FROM NotificationEntity n
      WHERE n.recipient.id = :recipientId
        AND n.readAt IS NULL
      """)
  long countUnread(UUID recipientId);

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
