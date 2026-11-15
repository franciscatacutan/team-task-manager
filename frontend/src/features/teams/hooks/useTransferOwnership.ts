import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateMembershipChange } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { transferTeam } from "../api/teamApi";

export function useTransferOwnership(teamKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.ownership(teamKey),
    mutationFn: (userId: string) => transferTeam(teamKey, userId),

    onSettled: (_member, _error, userId) =>
      invalidateMembershipChange(queryClient, teamKey, [userId]),
  });
}
