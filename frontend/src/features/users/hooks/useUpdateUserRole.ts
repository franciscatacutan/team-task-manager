import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateUserChange } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";

import { updateUserRole } from "../api/userApi";
import type { UserRole } from "../types/userRole";

export const useUpdateUserRole = (userId: string) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.userRole(userId),
    mutationFn: (role: UserRole) => updateUserRole(userId, { role }),
    onSettled: () => invalidateUserChange(queryClient, userId),
  });
};
