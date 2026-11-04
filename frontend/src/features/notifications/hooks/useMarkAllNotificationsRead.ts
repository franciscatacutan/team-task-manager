import { mutationKeys, queryKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import {
  invalidateNotifications,
  setConfirmedData,
} from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";

import { markAllNotificationsRead } from "../api/notificationApi";

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.notificationsRead,
    mutationFn: markAllNotificationsRead,
    onSuccess: (data) =>
      setConfirmedData(queryClient, queryKeys.notifications.unreadCount, data),
    onSettled: () => invalidateNotifications(queryClient),
  });
};
