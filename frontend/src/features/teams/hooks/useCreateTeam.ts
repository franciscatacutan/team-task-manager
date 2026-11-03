import { useAppMutation } from "@/common/query/useAppMutation";
import {
  setConfirmedData,
  invalidateTeamChange,
  invalidateTeamLists,
} from "@/common/query/queryCache";
import { queryKeys, mutationKeys } from "@/common/query/queryKeys";
import { useQueryClient } from "@tanstack/react-query";
import { createTeam } from "../api/teamApi";

export const useCreateTeam = () => {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.teamCreate,
    mutationFn: createTeam,

    onSuccess: async (team) => {
      await setConfirmedData(
        queryClient,
        queryKeys.teams.detail(team.key),
        team,
      );
    },
    onSettled: (team) =>
      team
        ? invalidateTeamChange(queryClient, team.key)
        : invalidateTeamLists(queryClient),
  });
};
