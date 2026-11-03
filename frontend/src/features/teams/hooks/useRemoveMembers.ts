import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMembers } from "../api/teamMemberApi";
import type { RemoveMembersInput } from "../types/team.type";
import { invalidateMembership } from "../utils/invalidateMembership";

export const useRemoveMembers = (teamKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RemoveMembersInput) => removeMembers(teamKey, data),
    onSettled: (_result, _error, data) => {
      invalidateMembership(queryClient, teamKey, data.userIds);
    },
  });
};
