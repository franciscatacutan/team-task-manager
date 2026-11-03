import { mutationKeys } from "@/common/query/queryKeys";
import { useAppMutation } from "@/common/query/useAppMutation";
import { invalidateTeamWorkspace } from "@/common/query/queryCache";
import { useQueryClient } from "@tanstack/react-query";
import { deleteTeam } from "../api/teamApi";

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useAppMutation({
    mutationKey: mutationKeys.teamArchive,
    mutationFn: (teamKey: string) => deleteTeam(teamKey),

    onSettled: (_data, _error, teamKey) =>
      invalidateTeamWorkspace(queryClient, teamKey),
  });
}
