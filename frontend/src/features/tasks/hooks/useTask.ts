import {
  isTaskUnavailable,
  isValidTaskScope,
} from "@/features/tasks/utils/taskView";
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
    queryFn: ({ signal }) => getTask(teamKey, projectKey, taskNumber, signal),
    enabled: isValidTaskScope({ teamKey, projectKey, taskNumber }),
    retry: (count, error) => count < 3 && !isTaskUnavailable(error),
  });
};
