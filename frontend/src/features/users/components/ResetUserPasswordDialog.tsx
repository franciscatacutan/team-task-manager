import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, ShieldAlert, XIcon } from "lucide-react";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import FormField from "@/common/components/FormFieldWrapper";
import { requestError } from "@/common/utils/requestError";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { User } from "../types/userType";
import { useAdminResetUserPassword } from "../hooks/useAdminResetUserPassword";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
type FormValues = z.infer<typeof schema>;
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

/** Sensitive drafts belong to one opening and one target, never to the directory page. */
export default function ResetUserPasswordDialog(props: Props) {
  if (!props.open || !props.user) return null;
  return (
    <PasswordResetEditor
      key={props.user.id}
      user={props.user}
      onOpenChange={props.onOpenChange}
    />
  );
}

function PasswordResetEditor({
  user,
  onOpenChange,
}: Omit<Props, "open" | "user"> & { user: User }) {
  const resetPassword = useAdminResetUserPassword(user.id);
  const inFlight = useRef(false);
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    const revision = authStorage.getRevision();
    const isCurrent = () =>
      active.current &&
      revision === authStorage.getRevision() &&
      !authStorage.isLoggingOut();
    try {
      await form.handleSubmit(async (values) => {
        setError("");
        try {
          await resetPassword.mutateAsync(values.password);
          if (isCurrent()) {
            form.reset();
            onOpenChange(false);
          }
        } catch (failure) {
          if (isCurrent())
            setError(
              isAxiosError(failure) && !failure.response
                ? "Could not confirm the password reset. The request may have succeeded. Verify the outcome before retrying."
                : requestError(
                    failure,
                    "Unable to reset this password. Please try again.",
                  ),
            );
        }
      })(event);
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!inFlight.current) onOpenChange(value);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 transition-none sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
              <ShieldAlert aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription className="text-foreground/75">
                Set a temporary password for{" "}
                <span className="font-medium text-foreground">
                  {user.firstName} {user.lastName}
                </span>
                .
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form
          noValidate
          aria-label="Reset user password"
          aria-busy={pending}
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <div
            data-slot="password-reset-body"
            className="min-h-0 overflow-y-auto px-6 py-5"
          >
            <fieldset disabled={pending} className="min-w-0 space-y-5">
              <FormField
                label="New password"
                required
                hint="8–100 characters."
                framed={false}
                error={form.formState.errors.password?.message}
              >
                {(control) => (
                  <Input
                    {...form.register("password")}
                    {...control}
                    aria-required="true"
                    type="password"
                    autoComplete="new-password"
                    maxLength={100}
                    className="h-11"
                  />
                )}
              </FormField>
              <FormField
                label="Confirm password"
                required
                framed={false}
                error={form.formState.errors.confirmPassword?.message}
              >
                {(control) => (
                  <Input
                    {...form.register("confirmPassword")}
                    {...control}
                    aria-required="true"
                    type="password"
                    autoComplete="new-password"
                    className="h-11"
                  />
                )}
              </FormField>
              <p className="rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-foreground/75">
                The user can sign in using the new password immediately after a
                successful reset. Share it with them securely.
              </p>
            </fieldset>
          </div>
          <div className="shrink-0 space-y-3 border-t bg-muted/30 px-6 py-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {pending && (
              <span role="status" className="sr-only">
                Resetting password...
              </span>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="bg-red-700 text-white hover:bg-red-800 dark:bg-red-700 dark:hover:bg-red-800"
                disabled={pending || !form.formState.isValid}
              >
                {pending && (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {pending ? "Resetting..." : "Reset password"}
              </Button>
            </div>
          </div>
        </form>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            className="absolute right-2 top-2"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
