import { useEffect, useRef, useState, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { AdminUpdateUserInput, User } from "../types/userType";
import type { UserRole } from "../types/userRole";
import { useUpdateUserProfile } from "../hooks/useUpdateUserProfile";
import { useAdminUpdateUser } from "../hooks/useAdminUpdateUser";
import { canEditUser } from "../utils/userPermissions";
import { userMutationError } from "../utils/userMutationError";
import { USER_ROLE_LABEL } from "../constants/user.constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { authStorage } from "@/features/auth/utils/authStorage";

interface Props {
  currentUser: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  allowEmailEdit?: boolean;
}
const schema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must be at most 100 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be at most 100 characters"),
  email: z
    .string()
    .trim()
    .max(150, "Email must be at most 150 characters")
    .pipe(z.email("Enter a valid email address")),
});
type Values = z.infer<typeof schema>;

/** Mount a fresh editor for each opening/person; background refetches must not erase drafts. */
export default function EditUserDialog(props: Props) {
  if (!props.open || !props.user) return null;
  return (
    <UserEditor
      key={JSON.stringify([
        props.user.id,
        props.currentUser.id,
        authStorage.getRevision(),
      ])}
      {...props}
      user={props.user}
    />
  );
}

function UserEditor({
  currentUser,
  user,
  onOpenChange,
  allowEmailEdit = true,
}: Props & { user: User }) {
  const [baseline] = useState(user);
  const [role, setRole] = useState<UserRole>(user.role);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const inFlight = useRef(false);
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const profile = useUpdateUserProfile(user.id);
  const admin = useAdminUpdateUser(user.id);
  const isSelf = currentUser.id === user.id;
  const canEdit = canEditUser(currentUser, user);
  const canEditEmail = canEdit && !isSelf && allowEmailEdit;
  const canManageRole =
    canEdit && !isSelf && currentUser.role === "SUPER_ADMIN";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });
  const values = useWatch({ control: form.control });
  const isSaving =
    pending ||
    profile.isPending ||
    admin.isPending ||
    form.formState.isSubmitting;
  const hasChanges =
    values.firstName?.trim() !== baseline.firstName ||
    values.lastName?.trim() !== baseline.lastName ||
    (canEditEmail && values.email?.trim() !== baseline.email) ||
    (canManageRole && role !== baseline.role);

  async function save(values: Values, isCurrent: () => boolean) {
    if (!canEdit || !isCurrent()) return;
    const input: AdminUpdateUserInput = {};
    if (values.firstName !== baseline.firstName)
      input.firstName = values.firstName;
    if (values.lastName !== baseline.lastName) input.lastName = values.lastName;
    if (canEditEmail && values.email !== baseline.email)
      input.email = values.email;
    if (canManageRole && role !== baseline.role) input.role = role;
    if (!Object.keys(input).length) return;
    setError("");
    try {
      if (isSelf)
        await profile.mutateAsync({
          firstName: input.firstName,
          lastName: input.lastName,
        });
      else await admin.mutateAsync(input);
      if (isCurrent()) onOpenChange(false);
    } catch (error) {
      if (isCurrent()) setError(userMutationError(error));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canEdit) return;
    inFlight.current = true;
    setPending(true);
    const revision = authStorage.getRevision();
    const isCurrent = () =>
      active.current &&
      revision === authStorage.getRevision() &&
      !authStorage.isLoggingOut();
    try {
      await form.handleSubmit((values) => save(values, isCurrent))(event);
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!inFlight.current) onOpenChange(open);
      }}
    >
      <DialogContent
        closeDisabled={isSaving}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 transition-none sm:max-w-xl"
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12">
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Save profile details{canEditEmail ? ", login email" : ""}
            {canManageRole ? ", and global role" : ""} together.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-user-form"
          noValidate
          aria-label="Edit user details"
          aria-busy={isSaving}
          onSubmit={(event) => {
            void submit(event);
          }}
          className="min-h-0 space-y-5 overflow-y-auto px-5 py-5"
        >
          <fieldset
            disabled={isSaving || !canEdit}
            className="grid min-w-0 gap-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-user-first-name">First name</Label>
                <Input
                  id="edit-user-first-name"
                  maxLength={100}
                  {...form.register("firstName")}
                  aria-invalid={Boolean(form.formState.errors.firstName)}
                  aria-describedby={
                    form.formState.errors.firstName
                      ? "edit-user-firstName-error"
                      : undefined
                  }
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.firstName && (
                  <p
                    id="edit-user-firstName-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-user-last-name">Last name</Label>
                <Input
                  id="edit-user-last-name"
                  maxLength={100}
                  {...form.register("lastName")}
                  aria-invalid={Boolean(form.formState.errors.lastName)}
                  aria-describedby={
                    form.formState.errors.lastName
                      ? "edit-user-lastName-error"
                      : undefined
                  }
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.lastName && (
                  <p
                    id="edit-user-lastName-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            {canEditEmail && (
              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  maxLength={150}
                  {...form.register("email")}
                  aria-invalid={Boolean(form.formState.errors.email)}
                  aria-describedby={
                    form.formState.errors.email
                      ? "edit-user-email-error"
                      : undefined
                  }
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.email && (
                  <p
                    id="edit-user-email-error"
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
            )}
            {canManageRole && (
              <div className="space-y-2">
                <Label htmlFor="edit-user-role">Global role</Label>
                <Select
                  value={role}
                  disabled={isSaving}
                  onValueChange={(value) => {
                    if (
                      value === "USER" ||
                      value === "ADMIN" ||
                      value === "SUPER_ADMIN"
                    )
                      setRole(value);
                  }}
                >
                  <SelectTrigger
                    id="edit-user-role"
                    className="h-10 w-full rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["USER", "ADMIN", "SUPER_ADMIN"] as const).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {USER_ROLE_LABEL[value]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </fieldset>
          {error && (
            <p ref={errorRef} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter className="mx-0 mb-0 shrink-0 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              if (!inFlight.current) onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-user-form"
            disabled={
              isSaving || !hasChanges || !form.formState.isValid || !canEdit
            }
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
