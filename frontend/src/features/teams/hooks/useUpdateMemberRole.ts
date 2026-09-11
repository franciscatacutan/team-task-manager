import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMemberRole } from "../api/teamMemberApi";

export const useUpdateMemberRole = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: "ADMIN" | "MEMBER";
    }) => updateMemberRole(teamKey, memberId, role),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", teamKey],
      });
    },
  });
};
