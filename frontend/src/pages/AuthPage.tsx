import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import FormField from "@/common/components/FormFieldWrapper";
import { useSessionFormSubmission } from "@/common/hooks/useSessionFormSubmission";
import {
  passwordRules,
  registrationSchema,
  signInSchema,
} from "@/common/validation/accountValidation";
import { accountRequestError } from "@/common/utils/accountRequestError";
import { useLogin } from "@/features/auth/hooks/useLogin";
import { useRegister } from "@/features/auth/hooks/useRegister";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { authStorage } from "@/features/auth/utils/authStorage";
import { browserSession } from "@/features/auth/utils/sessionCoordinator";

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};
export default function AuthPage() {
  const { user } = useAuth();
  return (
    <AuthForm key={JSON.stringify([user?.id, authStorage.getRevision()])} />
  );
}

function AuthForm() {
  const navigate = useNavigate();
  const login = useLogin(),
    register = useRegister();
  const submission = useSessionFormSubmission();
  const [isRegister, setIsRegister] = useState(false);
  const [serverError, setServerError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (serverError) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [serverError]);
  const [showPassword, setShowPassword] = useState(false),
    [showConfirmation, setShowConfirmation] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(isRegister ? registrationSchema : signInSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const busy = submission.pending || login.isPending || register.isPending;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submission.run(async (isCurrent) => {
      setServerError("");
      await form.handleSubmit(async (values) => {
        if (!isCurrent()) return;
        try {
          const data = isRegister
            ? await register.mutateAsync(values)
            : await login.mutateAsync({
                email: values.email,
                password: values.password,
              });
          // A successful login intentionally changes the revision. Match its confirmed token instead.
          if (
            submission.mounted.current &&
            !browserSession.sync() &&
            authStorage.getToken() === data.token &&
            !authStorage.isLoggingOut()
          )
            navigate("/teams", { replace: true });
        } catch (error) {
          if (isCurrent())
            setServerError(
              accountRequestError(error, isRegister ? "register" : "login"),
            );
        }
      })(event);
    });
  }
  function changeMode(next: boolean) {
    if (submission.inFlight.current) return;
    form.reset({ ...form.getValues(), password: "", confirmPassword: "" });
    setServerError("");
    setShowPassword(false);
    setShowConfirmation(false);
    setIsRegister(next);
    login.reset();
    register.reset();
  }
  const errors = form.formState.errors;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-main-layout bg-cover bg-center px-4 py-8">
      <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">
            <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          </CardTitle>
          <CardDescription>
            {isRegister
              ? "Enter your details to get started"
              : "Sign in to continue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            aria-label={isRegister ? "Create account" : "Sign in"}
            aria-busy={busy}
            onSubmit={(event) => {
              void submit(event);
            }}
            className="space-y-4"
          >
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              {isRegister && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="First name"
                    required
                    framed={false}
                    error={errors.firstName?.message}
                  >
                    {(control) => (
                      <Input
                        {...form.register("firstName")}
                        {...control}
                        aria-required="true"
                        autoComplete="given-name"
                        maxLength={100}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Last name"
                    required
                    framed={false}
                    error={errors.lastName?.message}
                  >
                    {(control) => (
                      <Input
                        {...form.register("lastName")}
                        {...control}
                        aria-required="true"
                        autoComplete="family-name"
                        maxLength={100}
                      />
                    )}
                  </FormField>
                </div>
              )}
              <FormField
                label="Email"
                required
                framed={false}
                error={errors.email?.message}
              >
                {(control) => (
                  <Input
                    {...form.register("email")}
                    {...control}
                    type="email"
                    aria-required="true"
                    autoComplete={isRegister ? "email" : "username"}
                    maxLength={150}
                  />
                )}
              </FormField>
              <FormField
                label="Password"
                required
                framed={false}
                hint={isRegister ? passwordRules : undefined}
                error={errors.password?.message}
              >
                {(control) => (
                  <div className="relative">
                    <Input
                      {...form.register("password")}
                      {...control}
                      aria-required="true"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isRegister ? "new-password" : "current-password"
                      }
                      className="pr-12"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      aria-controls={control.id}
                      className="absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <EyeOff aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                )}
              </FormField>
              {isRegister && (
                <FormField
                  label="Confirm password"
                  required
                  framed={false}
                  error={errors.confirmPassword?.message}
                >
                  {(control) => (
                    <div className="relative">
                      <Input
                        {...form.register("confirmPassword")}
                        {...control}
                        aria-required="true"
                        type={showConfirmation ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={busy}
                        aria-label={
                          showConfirmation
                            ? "Hide confirmation password"
                            : "Show confirmation password"
                        }
                        aria-pressed={showConfirmation}
                        aria-controls={control.id}
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowConfirmation((value) => !value)}
                      >
                        {showConfirmation ? (
                          <EyeOff aria-hidden="true" />
                        ) : (
                          <Eye aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  )}
                </FormField>
              )}
            </fieldset>
            {serverError && (
              <p
                ref={errorRef}
                role="alert"
                className="text-sm text-destructive"
              >
                {serverError}
              </p>
            )}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 aria-hidden="true" className="animate-spin" />
                  {isRegister ? "Creating account..." : "Signing in..."}
                </>
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {isRegister
              ? "Already have an account? "
              : "Don’t have an account? "}
            <Button
              type="button"
              variant="link"
              disabled={busy}
              onClick={() => changeMode(!isRegister)}
            >
              {isRegister ? "Sign in" : "Create account"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
