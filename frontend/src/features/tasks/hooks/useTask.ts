import { queryKeys } from "@/common/query/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { getTask } from "../api/taskApi";

export const useTask = (
  teamKey: string,
  projectKey: string,
  taskNumber: number,
) => {
  return useQuery({
    queryKey: queryKeys.tasks.detail(teamKey, projectKey, taskNumber),
    queryFn: () => getTask(teamKey, projectKey, taskNumber),
  });
};
