package com.example.task_manager.notification;

import com.example.task_manager.common.PageResponse;
import com.example.task_manager.notification.dto.NotificationResponse;
import com.example.task_manager.notification.dto.UnreadNotificationCountResponse;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

  private final NotificationService notificationService;

  @GetMapping
  public ResponseEntity<PageResponse<NotificationResponse>> getInbox(
      Pageable pageable, Authentication authentication) {
    return ResponseEntity.ok(notificationService.getInbox(authentication.getName(), pageable));
  }

  @GetMapping("/unread-count")
  public ResponseEntity<UnreadNotificationCountResponse> getUnreadCount(
      Authentication authentication) {
    return ResponseEntity.ok(notificationService.getUnreadCount(authentication.getName()));
  }

  @PatchMapping("/{notificationId}/read")
  public ResponseEntity<NotificationResponse> markRead(
      @PathVariable UUID notificationId, Authentication authentication) {
    return ResponseEntity.ok(
        notificationService.markRead(notificationId, authentication.getName()));
  }

  @PatchMapping("/read-all")
  public ResponseEntity<UnreadNotificationCountResponse> markAllRead(
      Authentication authentication) {
    return ResponseEntity.ok(notificationService.markAllRead(authentication.getName()));
  }
}
