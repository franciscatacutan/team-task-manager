import { isAxiosError } from "axios";
export function taskMutationError(error: unknown): string {
  return isAxiosError<{ message?: string }>(error) &&
    error.response?.data?.message
    ? error.response.data.message
    : "Unable to save task changes. Please try again.";
}
