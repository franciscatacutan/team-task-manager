import { isAxiosError } from "axios";
import type { TaskScope } from "@/features/tasks/types/task.types";

export const isValidTaskScope = ({
  teamKey,
  projectKey,
  taskNumber,
}: TaskScope) =>
  Boolean(
    teamKey && projectKey && Number.isSafeInteger(taskNumber) && taskNumber > 0,
  );

export const isTaskUnavailable = (error: unknown) =>
  isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
