import { useAppMutation } from "@/common/query/useAppMutation";
import { mutationKeys } from "@/common/query/queryKeys";
import { getNotificationDestination } from "../api/notificationApi";

/** Resolve afresh when opened, with the same session guard as the read action. */
export const useNotificationDestination = () =>
  useAppMutation({
    mutationKey: mutationKeys.notificationDestination,
    mutationFn: getNotificationDestination,
  });
