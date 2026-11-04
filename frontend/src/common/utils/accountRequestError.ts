import { isAxiosError } from "axios";
import {
  AuthSessionChangedError,
  SessionCoordinationError,
  SignedOutError,
} from "@/features/auth/utils/sessionCoordinator";

export function accountRequestError(
  error: unknown,
  operation: "login" | "register" | "credentials",
) {
  if (error instanceof SessionCoordinationError) return error.message;
  if (
    error instanceof AuthSessionChangedError ||
    error instanceof SignedOutError
  )
    return "The active session changed. Sign in again before continuing.";
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response)
      return operation === "register"
        ? "Could not confirm registration. The account may have been created. Try signing in before registering again."
        : operation === "credentials"
          ? "Could not confirm the change. It may have succeeded. Try signing in to verify before retrying."
          : "Unable to reach the sign-in service. Check your connection and try again.";
    if (status === 429)
      return "Too many attempts. Please wait before trying again.";
    if (status && status >= 500)
      return "The service is temporarily unavailable. Please try again.";
    if (operation === "login" && status === 401)
      return "Email or password is incorrect.";
    if (operation === "credentials" && status === 401)
      return "Your session could not be verified. Sign in again before continuing.";
    const data: unknown = error.response.data;
    const code =
      data && typeof data === "object" && "error" in data
        ? data.error
        : undefined;
    if (operation === "register" && code === "EMAIL_ALREADY_EXISTS")
      return "An account with this email already exists. Try signing in.";
    if (status === 403)
      return "This action is not permitted. Please contact an administrator.";
    if (status === 400 || status === 409) {
      const message =
        data && typeof data === "object" && "message" in data
          ? data.message
          : undefined;
      if (typeof message === "string" && message.trim()) return message;
      return "Check the entered details and try again.";
    }
  }
  return "Unable to complete the request. Please try again.";
}
