import { expect, it } from "vitest";
import { accountRequestError } from "./accountRequestError";
import {
  AuthSessionChangedError,
  SessionCoordinationError,
} from "@/features/auth/utils/sessionCoordinator";
it("reports uncertain registration without suggesting automatic duplicate registration", () => {
  expect(accountRequestError({ isAxiosError: true }, "register")).toContain(
    "Try signing in before registering again.",
  );
});
it("distinguishes an existing-email registration conflict", () => {
  expect(
    accountRequestError(
      {
        isAxiosError: true,
        response: { status: 409, data: { error: "EMAIL_ALREADY_EXISTS" } },
      },
      "register",
    ),
  ).toBe("An account with this email already exists. Try signing in.");
});
it("does not render malformed response values or internal server details", () => {
  expect(
    accountRequestError(
      {
        isAxiosError: true,
        response: { status: 400, data: { message: { internal: true } } },
      },
      "credentials",
    ),
  ).toBe("Check the entered details and try again.");
  expect(
    accountRequestError(
      {
        isAxiosError: true,
        response: {
          status: 503,
          data: { message: "internal database details" },
        },
      },
      "login",
    ),
  ).toBe("The service is temporarily unavailable. Please try again.");
});
it("keeps session coordination failures distinct from bad credentials", () => {
  expect(accountRequestError(new AuthSessionChangedError(), "login")).toContain(
    "active session changed",
  );
  expect(
    accountRequestError(new SessionCoordinationError(), "login"),
  ).toContain("Session coordination is unavailable");
});
