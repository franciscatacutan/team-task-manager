import { useQueryClient } from "@tanstack/react-query";
import { useAppMutation } from "@/common/query/useAppMutation";
import { mutationKeys } from "@/common/query/queryKeys";
import {
  setConfirmedUserData,
  invalidateUserChange,
} from "@/common/query/queryCache";
import { updateUserByAdmin } from "../api/userApi";
import type { AdminUpdateUserInput } from "../types/userType";

export function useAdminUpdateUser(userId: string) {
  const client = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.userAdminUpdate(userId),
    mutationFn: (input: AdminUpdateUserInput) =>
      updateUserByAdmin(userId, input),
    onSuccess: (user) => setConfirmedUserData(client, user),
    onSettled: () => invalidateUserChange(client, userId),
  });
}
