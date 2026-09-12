import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMembers } from "../api/teamMemberApi";

export const useAddMembers = (teamKey: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      members: { userId: string; role: "ADMIN" | "MEMBER" }[];
    }) => addMembers(teamKey, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", teamKey],
      });
      queryClient.invalidateQueries({
        queryKey: ["allTeamMembers", teamKey],
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
