import { isAxiosError } from "axios";
export function requestError(
  error: unknown,
  fallback = "Unable to save. Please try again.",
) {
  if (isAxiosError(error)) {
    if (!error.response)
      return "Could not confirm the change. Refresh the data before retrying.";
    const message: unknown = error.response.data?.message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
