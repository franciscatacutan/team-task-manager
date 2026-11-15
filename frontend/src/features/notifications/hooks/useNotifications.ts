import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getNotifications } from "../api/notificationApi";
import type { NotificationInboxParams } from "../types/notification.types";

export const useNotifications = (
  params: Partial<NotificationInboxParams> = {},
  enabled = true,
) => {
  const request: NotificationInboxParams = {
    page: 0,
    size: 12,
    sort: "createdAt,desc",
    unreadOnly: false,
    ...params,
  };
  return useQuery({
    queryKey: queryKeys.notifications.inboxPage(request),
    queryFn: ({ signal }) => getNotifications(request, signal),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
};
