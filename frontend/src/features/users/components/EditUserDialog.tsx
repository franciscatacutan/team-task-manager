import { useRef, useState } from "react";
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
  return <UserEditor key={props.user.id} {...props} user={props.user} />;
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
  const inFlight = useRef(false);
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
    profile.isPending || admin.isPending || form.formState.isSubmitting;
  const hasChanges =
    values.firstName?.trim() !== baseline.firstName ||
    values.lastName?.trim() !== baseline.lastName ||
    (canEditEmail && values.email?.trim() !== baseline.email) ||
    (canManageRole && role !== baseline.role);

  async function save(values: Values) {
    if (inFlight.current || !canEdit) return;
    const input: AdminUpdateUserInput = {};
    if (values.firstName !== baseline.firstName)
      input.firstName = values.firstName;
    if (values.lastName !== baseline.lastName) input.lastName = values.lastName;
    if (canEditEmail && values.email !== baseline.email)
      input.email = values.email;
    if (canManageRole && role !== baseline.role) input.role = role;
    if (!Object.keys(input).length) return;
    inFlight.current = true;
    setError("");
    try {
      if (isSelf)
        await profile.mutateAsync({
          firstName: input.firstName,
          lastName: input.lastName,
        });
      else await admin.mutateAsync(input);
      onOpenChange(false);
    } catch (error) {
      setError(userMutationError(error));
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!isSaving) onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Save profile details{canEditEmail ? ", login email" : ""}
            {canManageRole ? ", and global role" : ""} together.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-user-form"
          onSubmit={(event) => {
            void form.handleSubmit(save)(event);
          }}
          className="grid gap-5 px-5 py-5"
        >
          <fieldset disabled={isSaving || !canEdit} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-user-first-name">First name</Label>
                <Input
                  id="edit-user-first-name"
                  maxLength={100}
                  {...form.register("firstName")}
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.firstName && (
                  <p role="alert" className="text-xs text-destructive">
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
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.lastName && (
                  <p role="alert" className="text-xs text-destructive">
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
                  className="h-10 rounded-xl"
                />
                {form.formState.errors.email && (
                  <p role="alert" className="text-xs text-destructive">
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
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter className="px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
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
