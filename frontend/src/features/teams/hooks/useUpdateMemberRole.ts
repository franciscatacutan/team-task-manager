import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateMembershipChange } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { updateMemberRole } from "../api/teamMemberApi";

export const useUpdateMemberRole = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.memberRole(teamKey),
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateMemberRole(teamKey, memberId, role),

    onSettled: (_member, _error, { memberId }) =>
      invalidateMembershipChange(queryClient, teamKey, [memberId]),
  });
};
