import { useQuery } from "@tanstack/react-query";
import { getTask } from "../api/taskApi";

export const useTask = (teamKey: string, projectKey: string, taskId: string) => {
  return useQuery({
    queryKey: ["task", teamKey, projectKey, taskId],
    queryFn: () => getTask(teamKey, projectKey, taskId),
  });
};
