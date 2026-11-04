import { useAppMutation } from "@/common/query/useAppMutation";
import { mutationKeys } from "@/common/query/queryKeys";

import { resetUserPasswordByAdmin } from "../api/userApi";

export const useAdminResetUserPassword = (userId: string) => {
  return useAppMutation({
    mutationKey: mutationKeys.userPasswordReset(userId),
    mutationFn: (newPassword: string) =>
      resetUserPasswordByAdmin(userId, { newPassword }),
  });
};
