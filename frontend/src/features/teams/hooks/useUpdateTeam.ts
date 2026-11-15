import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTeamChange,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import type { UpdateTeamInput } from "../types/team.type";
import { updateTeam } from "../api/teamApi";

export function useUpdateTeam(teamKey: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.teamUpdate(teamKey),
    mutationFn: (data: UpdateTeamInput) => updateTeam(teamKey, data),

    onSuccess: async (team) => {
      await setConfirmedData(
        queryClient,
        queryKeys.teams.detail(teamKey),
        team,
      );
    },
    onSettled: () => invalidateTeamChange(queryClient, teamKey),
  });
}
