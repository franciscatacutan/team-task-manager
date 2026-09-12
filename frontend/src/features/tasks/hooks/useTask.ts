import { useQuery } from "@tanstack/react-query";
import { getTask } from "../api/taskApi";

export const useTask = (teamKey: string, projectKey: string, taskNumber: number) => {
  return useQuery({
    queryKey: ["task", teamKey, projectKey, taskNumber],
    queryFn: () => getTask(teamKey, projectKey, taskNumber),
  });
};
