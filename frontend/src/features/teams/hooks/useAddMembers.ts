import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMembers } from "../api/teamMemberApi";
import type { AddMembersInput } from "../types/team.type";
import { invalidateMembership } from "../utils/invalidateMembership";

export const useAddMembers = (teamKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddMembersInput) => addMembers(teamKey, data),
    onSettled: (_result, _error, data) => {
      invalidateMembership(
        queryClient,
        teamKey,
        data.members.map((member) => member.userId),
      );
    },
  });
};
