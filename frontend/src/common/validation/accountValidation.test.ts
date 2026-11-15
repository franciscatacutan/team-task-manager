import { describe, expect, it } from "vitest";
import {
  accountEmailSchema,
  emailChangeSchema,
  passwordChangeSchema,
  registrationSchema,
  signInSchema,
} from "./accountValidation";
const values = {
  firstName: "Éva-Marie",
  lastName: "O'Neil",
  email: "person@example.test",
  password: "Strong123!",
  confirmPassword: "Strong123!",
};
describe("account validation contracts", () => {
  it("normalizes identity fields while preserving every password character", () => {
    const input = {
      ...values,
      firstName: " Éva-Marie ",
      email: " person@example.test ",
      password: " Strong123! ",
      confirmPassword: " Strong123! ",
    };
    expect(registrationSchema.parse(input)).toEqual({
      ...input,
      firstName: values.firstName,
      email: values.email,
    });
    expect(signInSchema.parse({ ...values, password: " a " }).password).toBe(
      " a ",
    );
  });
  it.each(["short", "abcdefgh", "PASSWORD1!", "Abcdefgh!", "Abcd1234"])(
    "keeps creation requirements while allowing the existing secret %s at sign-in",
    (password) => {
      expect(signInSchema.safeParse({ ...values, password }).success).toBe(
        true,
      );
      expect(
        registrationSchema.safeParse({
          ...values,
          password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
      expect(
        passwordChangeSchema.safeParse({
          currentPassword: "old",
          newPassword: password,
          confirmPassword: password,
        }).success,
      ).toBe(false);
    },
  );
  it("applies the existing storage boundaries to names and email", () => {
    expect(
      registrationSchema.safeParse({
        ...values,
        firstName: "a".repeat(100),
        lastName: "b".repeat(100),
      }).success,
    ).toBe(true);
    expect(
      registrationSchema.safeParse({ ...values, firstName: "a".repeat(101) })
        .success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...values, lastName: "b".repeat(101) })
        .success,
    ).toBe(false);
    const email = "a".repeat(64) + "@" + "b".repeat(63) + "." + "c".repeat(21);
    expect(accountEmailSchema.safeParse(email).success).toBe(true);
    expect(accountEmailSchema.safeParse(email + "c").success).toBe(false);
  });
  it("requires confirmation and a nonblank current password without applying new rules to the old secret", () => {
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "old",
        newPassword: values.password,
        confirmPassword: values.password,
      }).success,
    ).toBe(true);
    expect(
      passwordChangeSchema.safeParse({
        currentPassword: "old",
        newPassword: values.password,
        confirmPassword: "different",
      }).success,
    ).toBe(false);
    expect(
      emailChangeSchema.safeParse({
        newEmail: values.email,
        currentPassword: " ",
      }).success,
    ).toBe(false);
  });
});
