import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeMembers } from "../api/teamMemberApi";

export const useRemoveMembers = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { userIds: string[] }) => removeMembers(teamKey, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", teamKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["availableUsers", teamKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["team", teamKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["teams"],
      });
    },
  });
};
