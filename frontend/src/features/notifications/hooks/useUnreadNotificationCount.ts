import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";

import { getUnreadNotificationCount } from "../api/notificationApi";

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: ({ signal }) => getUnreadNotificationCount(signal),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
};
