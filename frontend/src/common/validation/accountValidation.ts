import { z } from "zod";

export const passwordRules =
  "Use 8+ characters with uppercase, lowercase, number, and special character.";
// Match the server's existing new-password rule. Never trim or transform passwords.
export const newPasswordSchema = z
  .string()
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-[\]{};':"\\|,.<>/?]).{8,}$/,
    "Password does not meet the requirements",
  );
export const requiredPassword = (message = "Password is required") =>
  z.string().refine((value) => value.trim().length > 0, message);
export const accountEmailSchema = z
  .string()
  .trim()
  .max(150, "Email must be at most 150 characters")
  .pipe(z.email("Enter a valid email address"));
const registrationName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`)
    .regex(
      /^[\p{L} .'-]+$/u,
      `${label} may contain letters, spaces, periods, apostrophes and hyphens`,
    );
export const signInSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: accountEmailSchema,
  password: requiredPassword(),
  confirmPassword: z.string(),
});
export const registrationSchema = signInSchema
  .extend({
    firstName: registrationName("First name"),
    lastName: registrationName("Last name"),
    password: newPasswordSchema,
    confirmPassword: requiredPassword("Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export const emailChangeSchema = z.object({
  newEmail: accountEmailSchema,
  currentPassword: requiredPassword("Current password is required"),
});
export const passwordChangeSchema = z
  .object({
    currentPassword: requiredPassword("Current password is required"),
    newPassword: newPasswordSchema,
    confirmPassword: requiredPassword("Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
