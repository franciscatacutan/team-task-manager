package com.example.task_manager.notification.dto;

public record NotificationDestinationResponse(boolean available, String targetPath) {
  public static NotificationDestinationResponse unavailable() {
    return new NotificationDestinationResponse(false, null);
  }

  public static NotificationDestinationResponse available(String path) {
    return new NotificationDestinationResponse(true, path);
  }
}
