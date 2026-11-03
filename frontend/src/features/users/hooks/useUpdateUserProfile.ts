import type { User } from "../types/userType";
import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateUserChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";

import { updateUserProfile } from "../api/userApi";

export const useUpdateUserProfile = (userId: string) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.userProfile(userId),
    mutationFn: (payload: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }) => updateUserProfile(userId, payload),
    onSuccess: async (user) => {
      const writes = [
        setConfirmedData(queryClient, queryKeys.users.detail(userId), user),
      ];
      if (
        queryClient.getQueryData<User>(queryKeys.session.current)?.id === userId
      ) {
        writes.push(
          setConfirmedData(queryClient, queryKeys.session.current, user),
        );
      }
      await Promise.all(writes);
    },
    // The existing multi-request edit can partially commit; refresh actual state even on failure.
    onSettled: () => invalidateUserChange(queryClient, userId),
  });
};
