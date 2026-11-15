import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateNotifications } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";

import { markNotificationRead } from "../api/notificationApi";

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.notificationRead,
    mutationFn: markNotificationRead,
    onSettled: () => invalidateNotifications(queryClient),
  });
};
