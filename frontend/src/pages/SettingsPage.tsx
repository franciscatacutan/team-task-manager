import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link } from "react-router";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import {
  CheckCircle2,
  LockKeyhole,
  Mail,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUpdateAccountEmail } from "@/features/settings/hooks/useUpdateAccountEmail";
import { useUpdatePassword } from "@/features/settings/hooks/useUpdatePassword";
import { useThemePreference } from "@/features/settings/hooks/useThemePreference";
import { cn } from "@/lib/utils";

const passwordRules =
  "Use 8+ characters with uppercase, lowercase, number, and special character.";

const passwordPattern =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-[\]{};':"\\|,.<>/?]).{8,}$/;

const emailSchema = z.object({
  newEmail: z.string().trim().email("Enter a valid email address"),
  currentPassword: z.string().min(1, "Current password is required"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .regex(passwordPattern, "Password does not meet the requirements"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

const themeOptions = [
  {
    value: "system",
    label: "System",
    icon: Monitor,
    description: "Match this device",
  },
  {
    value: "light",
    label: "Light",
    icon: Sun,
    description: "Bright workspace",
  },
  {
    value: "dark",
    label: "Dark",
    icon: Moon,
    description: "Low-light workspace",
  },
] as const;

export default function SettingsPage() {
  const { logout } = useAuth();
  const { data: user, isLoading } = useCurrentUser();
  const updateEmail = useUpdateAccountEmail();
  const updatePassword = useUpdatePassword(user?.id ?? "");
  const { theme, setTheme } = useThemePreference();

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [preferenceSaved, setPreferenceSaved] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      newEmail: "",
      currentPassword: "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const currentEmail = user?.email;

  const initials = useMemo(() => {
    if (!user) return "U";
    return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || "U";
  }, [user]);

  useEffect(() => {
    if (!currentEmail) return;

    emailForm.reset({
      newEmail: currentEmail,
      currentPassword: "",
    });
  }, [currentEmail, emailForm]);

  const handleEmailSubmit = async (values: EmailFormValues) => {
    setEmailError("");

    try {
      await updateEmail.mutateAsync({
        newEmail: values.newEmail.trim(),
        currentPassword: values.currentPassword,
      });
      await logout();
    } catch (error) {
      setEmailError(
        getErrorMessage(error, "Unable to update your email right now."),
      );
    }
  };

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    if (!user) return;

    setPasswordError("");

    try {
      await updatePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      await logout();
    } catch (error) {
      setPasswordError(
        getErrorMessage(error, "Unable to update your password right now."),
      );
    }
  };

  const handleThemeChange = (nextTheme: typeof theme) => {
    setTheme(nextTheme);
    setPreferenceSaved(true);
    window.setTimeout(() => setPreferenceSaved(false), 1800);
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10 p-6">
        <div className="rounded-xl border border-border/60 bg-background p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold">Settings unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in again to manage your account settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto bg-muted/10 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-primary/10 text-base font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Account settings
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/profile">
              <UserRound className="h-4 w-4" />
              View Profile
            </Link>
          </Button>
        </header>

        <Tabs
          defaultValue="account"
          className="grid gap-5 lg:grid-cols-[14rem_1fr]"
        >
          <TabsList className="h-fit flex-col items-stretch justify-start gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-sm">
            <TabsTrigger
              value="account"
              className="justify-start gap-2 rounded-lg"
            >
              <Mail className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="justify-start gap-2 rounded-lg"
            >
              <ShieldCheck className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="justify-start gap-2 rounded-lg"
            >
              <Palette className="h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          <div className="min-w-0">
            <TabsContent value="account" className="mt-0">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Login email</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    This email is used for sign-in and account recovery.
                    Changing it signs you out so you can continue with the new
                    address.
                  </p>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                    className="grid gap-5"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="settings-email">New email</Label>
                        <Input
                          id="settings-email"
                          type="email"
                          className="h-10 rounded-xl"
                          {...emailForm.register("newEmail")}
                        />
                        {emailForm.formState.errors.newEmail && (
                          <p className="text-xs text-destructive">
                            {emailForm.formState.errors.newEmail.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="settings-email-password">
                          Current password
                        </Label>
                        <Input
                          id="settings-email-password"
                          type="password"
                          className="h-10 rounded-xl"
                          autoComplete="current-password"
                          {...emailForm.register("currentPassword")}
                        />
                        {emailForm.formState.errors.currentPassword && (
                          <p className="text-xs text-destructive">
                            {emailForm.formState.errors.currentPassword.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {emailError && (
                      <p className="text-sm text-destructive">{emailError}</p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-xl"
                        disabled={updateEmail.isPending}
                      >
                        {updateEmail.isPending ? "Updating..." : "Update email"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Password changes revoke active sessions and require a fresh
                    login.
                  </p>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                    className="grid gap-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-3">
                      <PasswordField
                        id="settings-current-password"
                        label="Current password"
                        autoComplete="current-password"
                        registration={passwordForm.register("currentPassword")}
                        error={
                          passwordForm.formState.errors.currentPassword?.message
                        }
                      />
                      <PasswordField
                        id="settings-new-password"
                        label="New password"
                        autoComplete="new-password"
                        registration={passwordForm.register("newPassword")}
                        error={
                          passwordForm.formState.errors.newPassword?.message
                        }
                      />
                      <PasswordField
                        id="settings-confirm-password"
                        label="Confirm password"
                        autoComplete="new-password"
                        registration={passwordForm.register("confirmPassword")}
                        error={
                          passwordForm.formState.errors.confirmPassword?.message
                        }
                      />
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 text-sm text-muted-foreground">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{passwordRules}</span>
                    </div>

                    {passwordError && (
                      <p className="text-sm text-destructive">
                        {passwordError}
                      </p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-xl"
                        disabled={updatePassword.isPending}
                      >
                        {updatePassword.isPending
                          ? "Updating..."
                          : "Update password"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preferences" className="mt-0">
              <Card className="rounded-xl border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose how the workspace should look on this device.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      const isSelected = theme === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleThemeChange(option.value)}
                          className={cn(
                            "flex min-h-28 flex-col items-start justify-between rounded-xl border border-border/60 bg-background p-4 text-left transition hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected &&
                              "border-primary bg-primary/5 ring-1 ring-primary/20",
                          )}
                        >
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <span>
                            <span className="block font-medium">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-sm text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Separator />

                  <div className="flex min-h-9 items-center text-sm text-muted-foreground">
                    {preferenceSaved && (
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Preference saved
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  registration,
  error,
}: {
  id: string;
  label: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        className="h-10 rounded-xl"
        autoComplete={autoComplete}
        {...registration}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="h-full bg-muted/10 p-6">
      <div className="mx-auto grid max-w-6xl gap-5">
        <div className="h-28 animate-pulse rounded-xl bg-muted/40" />
        <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
          <div className="h-36 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-80 animate-pulse rounded-xl bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
