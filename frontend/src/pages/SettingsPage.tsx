import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
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
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useUpdateAccountEmail } from "@/features/settings/hooks/useUpdateAccountEmail";
import { useUpdatePassword } from "@/features/settings/hooks/useUpdatePassword";
import { useThemePreference } from "@/features/settings/hooks/useThemePreference";
import { cn } from "@/lib/utils";

import { accountRequestError } from "@/common/utils/accountRequestError";
import {
  emailChangeSchema as emailSchema,
  passwordChangeSchema as passwordSchema,
  passwordRules,
} from "@/common/validation/accountValidation";
import { useSessionFormSubmission } from "@/common/hooks/useSessionFormSubmission";
import QueryFailure from "@/common/components/QueryFailure";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { User } from "@/features/users/types/userType";

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
  const query = useCurrentUser();
  if (query.isLoading) return <SettingsSkeleton />;
  if (!query.data)
    return (
      <div className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Settings unavailable</h1>
        <QueryFailure
          label="account settings"
          onRetry={query.refetch}
          pending={query.isFetching}
        />
      </div>
    );
  return (
    <SettingsEditor
      key={JSON.stringify([query.data.id, authStorage.getRevision()])}
      user={query.data}
      feedback={
        query.isError ? (
          <QueryFailure
            label="the latest account settings"
            onRetry={query.refetch}
            pending={query.isFetching}
          />
        ) : null
      }
    />
  );
}

function SettingsEditor({
  user,
  feedback,
}: {
  user: User;
  feedback: ReactNode;
}) {
  const submission = useSessionFormSubmission();
  const [tab, setTab] = useState("account");
  const updateEmail = useUpdateAccountEmail();
  const updatePassword = useUpdatePassword(user.id);
  const { theme, setTheme } = useThemePreference();

  const busy =
    submission.pending || updateEmail.isPending || updatePassword.isPending;
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [preferenceSaved, setPreferenceSaved] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      newEmail: user.email,
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

  const initials = useMemo(() => {
    if (!user) return "U";
    return `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}` || "U";
  }, [user]);

  useEffect(() => {
    if (emailError || passwordError)
      feedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [emailError, passwordError]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submission.run(async (isCurrent) => {
      setEmailError("");
      await emailForm.handleSubmit(async (values) => {
        if (!isCurrent()) return;
        try {
          await updateEmail.mutateAsync({
            newEmail: values.newEmail,
            currentPassword: values.currentPassword,
          });
          if (isCurrent()) emailForm.reset({ ...values, currentPassword: "" });
        } catch (error) {
          if (isCurrent())
            setEmailError(accountRequestError(error, "credentials"));
        }
      })(event);
    });
  }
  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submission.run(async (isCurrent) => {
      setPasswordError("");
      await passwordForm.handleSubmit(async (values) => {
        if (!isCurrent()) return;
        try {
          await updatePassword.mutateAsync({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          });
          if (isCurrent()) passwordForm.reset();
        } catch (error) {
          if (isCurrent())
            setPasswordError(accountRequestError(error, "credentials"));
        }
      })(event);
    });
  }
  function changeTab(next: string) {
    if (submission.inFlight.current) return;
    emailForm.reset({ ...emailForm.getValues(), currentPassword: "" });
    passwordForm.reset();
    setEmailError("");
    setPasswordError("");
    updateEmail.reset();
    updatePassword.reset();
    setTab(next);
  }

  const handleThemeChange = (nextTheme: typeof theme) => {
    if (submission.inFlight.current) return;
    setTheme(nextTheme);
    setPreferenceSaved(true);
    window.setTimeout(() => setPreferenceSaved(false), 1800);
  };

  return (
    <div className="h-full min-h-0 overflow-auto bg-muted/10 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {feedback}
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
          orientation="vertical"
          value={tab}
          onValueChange={changeTab}
          className="grid gap-5 lg:grid-cols-[14rem_1fr]"
        >
          <TabsList className="h-auto w-full flex-col items-stretch justify-start gap-1 rounded-xl border border-border/60 bg-background p-1 shadow-sm">
            <TabsTrigger
              value="account"
              disabled={busy}
              className="h-auto flex-none justify-start gap-2 rounded-lg px-3 py-2"
            >
              <Mail className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger
              value="security"
              disabled={busy}
              className="h-auto flex-none justify-start gap-2 rounded-lg px-3 py-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              disabled={busy}
              className="h-auto flex-none justify-start gap-2 rounded-lg px-3 py-2"
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
                    noValidate
                    aria-label="Change login email"
                    aria-busy={busy}
                    onSubmit={(event) => {
                      void submitEmail(event);
                    }}
                    className="grid gap-5"
                  >
                    <fieldset disabled={busy} className="grid min-w-0 gap-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="settings-email">New email</Label>
                          <Input
                            id="settings-email"
                            maxLength={150}
                            autoComplete="email"
                            type="email"
                            className="h-10 rounded-xl"
                            {...emailForm.register("newEmail")}
                            aria-required="true"
                            aria-invalid={Boolean(
                              emailForm.formState.errors.newEmail,
                            )}
                            aria-describedby={
                              emailForm.formState.errors.newEmail
                                ? "settings-email-error"
                                : undefined
                            }
                          />
                          {emailForm.formState.errors.newEmail && (
                            <p
                              id="settings-email-error"
                              role="alert"
                              className="text-xs text-destructive"
                            >
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
                            aria-required="true"
                            aria-invalid={Boolean(
                              emailForm.formState.errors.currentPassword,
                            )}
                            aria-describedby={
                              emailForm.formState.errors.currentPassword
                                ? "settings-email-password-error"
                                : undefined
                            }
                          />
                          {emailForm.formState.errors.currentPassword && (
                            <p
                              id="settings-email-password-error"
                              role="alert"
                              className="text-xs text-destructive"
                            >
                              {
                                emailForm.formState.errors.currentPassword
                                  .message
                              }
                            </p>
                          )}
                        </div>
                      </div>
                    </fieldset>
                    {emailError && (
                      <p
                        ref={feedbackRef}
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {emailError}
                      </p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-xl"
                        disabled={busy}
                      >
                        {busy ? "Updating..." : "Update email"}
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
                    noValidate
                    aria-label="Change password"
                    aria-busy={busy}
                    onSubmit={(event) => {
                      void submitPassword(event);
                    }}
                    className="grid gap-5"
                  >
                    <fieldset disabled={busy} className="grid min-w-0 gap-5">
                      <div className="grid gap-4 lg:grid-cols-3">
                        <PasswordField
                          id="settings-current-password"
                          label="Current password"
                          autoComplete="current-password"
                          registration={passwordForm.register(
                            "currentPassword",
                          )}
                          error={
                            passwordForm.formState.errors.currentPassword
                              ?.message
                          }
                        />
                        <PasswordField
                          id="settings-new-password"
                          hintId="settings-password-rules"
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
                          registration={passwordForm.register(
                            "confirmPassword",
                          )}
                          error={
                            passwordForm.formState.errors.confirmPassword
                              ?.message
                          }
                        />
                      </div>

                      <div
                        id="settings-password-rules"
                        className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 text-sm text-foreground/75"
                      >
                        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{passwordRules}</span>
                      </div>
                    </fieldset>
                    {passwordError && (
                      <p
                        ref={feedbackRef}
                        role="alert"
                        className="text-sm text-destructive"
                      >
                        {passwordError}
                      </p>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-xl"
                        disabled={busy}
                      >
                        {busy ? "Updating..." : "Update password"}
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
                          aria-pressed={isSelected}
                          disabled={busy}
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
                      <span
                        role="status"
                        className="inline-flex items-center gap-2 text-foreground"
                      >
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
  hintId,
}: {
  id: string;
  label: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
  error?: string;
  hintId?: string;
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
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={
          [hintId, error ? `${id}-error` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
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
