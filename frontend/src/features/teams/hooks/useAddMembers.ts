import { mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { addMembers } from "../api/teamMemberApi";
import type { AddMembersInput } from "../types/team.type";
import { invalidateMembershipChange } from "@/common/query/queryCache";
import { useAppMutation } from "@/common/query/useAppMutation";

export const useAddMembers = (teamKey: string) => {
  const queryClient = useQueryClient();
  return useAppMutation({
    mutationKey: mutationKeys.membersAdd(teamKey),
    mutationFn: (data: AddMembersInput) => addMembers(teamKey, data),
    onSettled: (_result, _error, data) => {
      return invalidateMembershipChange(
        queryClient,
        teamKey,
        data.members.map((member) => member.userId),
      );
    },
  });
};
