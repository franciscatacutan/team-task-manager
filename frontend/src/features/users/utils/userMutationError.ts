import { isAxiosError } from "axios";
export function userMutationError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response)
      return "Could not confirm the save. Refresh the profile before trying again.";
    const message: unknown = error.response.data?.message;
    if (typeof message === "string") return message;
  }
  return "Unable to save this user right now. Refresh the profile and try again.";
}
