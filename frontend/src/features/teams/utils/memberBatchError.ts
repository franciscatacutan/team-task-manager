import { isAxiosError } from "axios";
export function memberBatchError(error: unknown): string {
  if (
    isAxiosError<{ message?: string }>(error) &&
    error.response?.data?.message
  )
    return error.response.data.message;
  return "Unable to confirm the changes. Refresh the member list to check what completed before retrying.";
}
