import { useQueryClient } from "@tanstack/react-query";
import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedUserData,
  invalidateUserChange,
} from "@/common/query/queryCache";
import { mutationKeys } from "@/common/query/queryKeys";
import { updateUserProfile } from "../api/userApi";
import type { UpdateUserProfileInput } from "../types/userType";

export function useUpdateUserProfile(userId: string) {
  const client = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.userProfile(userId),
    mutationFn: (payload: UpdateUserProfileInput) =>
      updateUserProfile(userId, payload),
    onSuccess: (user) => setConfirmedUserData(client, user),
    onSettled: () => invalidateUserChange(client, userId),
  });
}
