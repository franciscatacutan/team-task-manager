import { useQuery } from "@tanstack/react-query";
import { getTask } from "../api/taskApi";

export const useTask = (teamKey: string, projectId: string, taskId: string) => {
  return useQuery({
    queryKey: ["task", teamKey, projectId, taskId],
    queryFn: () => getTask(teamKey, projectId, taskId),
  });
};
