import { useAppMutation } from "@/common/query/useAppMutation";
import { mutationKeys } from "@/common/query/queryKeys";

import { updatePassword, type UpdatePasswordPayload } from "../api/settingsApi";

export const useUpdatePassword = (userId: string) => {
  return useAppMutation({
    mutationKey: mutationKeys.accountPassword(userId),
    mutationFn: (payload: UpdatePasswordPayload) =>
      updatePassword(userId, payload),
  });
};
