import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transferTeam } from "../api/teamApi";

export function useTransferOwnership(teamKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => transferTeam(teamKey, userId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-me", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["allTeamMembers", teamKey] });
      queryClient.invalidateQueries({ queryKey: ["teamActivity", teamKey] });
      queryClient.invalidateQueries({
        queryKey: ["teamMembers", teamKey],
      });

      queryClient.invalidateQueries({
        queryKey: ["team", teamKey],
      });
    },
  });
}
