import { mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { removeMembers } from "../api/teamMemberApi";
import type { RemoveMembersInput } from "../types/team.type";
import { invalidateMembershipChange } from "@/common/query/queryCache";
import { useAppMutation } from "@/common/query/useAppMutation";

export const useRemoveMembers = (teamKey: string) => {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.membersRemove(teamKey),
    mutationFn: (data: RemoveMembersInput) => removeMembers(teamKey, data),
    onSettled: (_result, _error, data) => {
      return invalidateMembershipChange(queryClient, teamKey, data.userIds);
    },
  });
};
