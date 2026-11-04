import { apiClient } from "@/api/apiClients";
import type { PageResponse } from "@/common/types/pageResponse.types";

import type {
  AppNotification,
  NotificationInboxParams,
  UnreadNotificationCount,
} from "../types/notification.types";

export const getNotifications = async (
  params: NotificationInboxParams,
  signal?: AbortSignal,
): Promise<PageResponse<AppNotification>> => {
  const response = await apiClient.get("/notifications", { params, signal });
  return response.data;
};

export const getUnreadNotificationCount = async (
  signal?: AbortSignal,
): Promise<UnreadNotificationCount> => {
  const response = await apiClient.get("/notifications/unread-count", {
    signal,
  });
  return response.data;
};

export const markNotificationRead = async (
  notificationId: string,
): Promise<AppNotification> => {
  const response = await apiClient.patch(
    `/notifications/${notificationId}/read`,
  );
  return response.data;
};

export const markAllNotificationsRead =
  async (): Promise<UnreadNotificationCount> => {
    const response = await apiClient.patch("/notifications/read-all");
    return response.data;
  };
