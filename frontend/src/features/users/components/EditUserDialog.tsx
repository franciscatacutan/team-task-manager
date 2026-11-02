import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import type { User } from "../types/userType";
import type { UserRole } from "../types/userRole";
import { useUpdateUserProfile } from "../hooks/useUpdateUserProfile";
import { useUpdateUserRole } from "../hooks/useUpdateUserRole";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

type Props = {
  currentUser: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  allowEmailEdit?: boolean;
};

const ROLE_LABELS: Record<UserRole, string> = {
  USER: "User",
  ADMIN: "Global Admin",
  SUPER_ADMIN: "Super Admin",
};

const editUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

export default function EditUserDialog({
  currentUser,
  open,
  onOpenChange,
  user,
  allowEmailEdit = true,
}: Props) {
  const updateProfile = useUpdateUserProfile(user?.id ?? "");
  const updateRole = useUpdateUserRole(user?.id ?? "");
  const [role, setRole] = useState<UserRole>("USER");
  const [error, setError] = useState("");

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  useEffect(() => {
    if (!user) return;

    form.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRole(user.role);
    setError("");
  }, [form, user]);

  if (!user) return null;

  const canManageRole =
    currentUser.role === "SUPER_ADMIN" && currentUser.id !== user.id;
  const isSaving = updateProfile.isPending || updateRole.isPending;

  const handleSave = async (values: EditUserFormValues) => {
    setError("");

    try {
      const payload = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        ...(allowEmailEdit ? { email: values.email.trim() } : {}),
      };

      await updateProfile.mutateAsync(payload);

      if (canManageRole && role !== user.role) {
        await updateRole.mutateAsync(role);
      }

      form.reset(payload);
      onOpenChange(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Unable to update this user right now.";
      setError(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile details
            {allowEmailEdit ? ", login email," : ""} and, if allowed, their
            global access level.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSave)}
          className="grid gap-5 px-5 py-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-user-first-name">First name</Label>
              <Input
                id="edit-user-first-name"
                {...form.register("firstName")}
                className="h-10 rounded-xl"
              />
              {form.formState.errors.firstName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-user-last-name">Last name</Label>
              <Input
                id="edit-user-last-name"
                {...form.register("lastName")}
                className="h-10 rounded-xl"
              />
              {form.formState.errors.lastName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {allowEmailEdit && (
            <div className="space-y-2">
              <Label htmlFor="edit-user-email">Email</Label>
              <Input
                id="edit-user-email"
                type="email"
                {...form.register("email")}
                className="h-10 rounded-xl"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
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
                onValueChange={(value) => setRole(value as UserRole)}
              >
                <SelectTrigger
                  id="edit-user-role"
                  className="h-10 w-full rounded-xl"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">{ROLE_LABELS.USER}</SelectItem>
                  <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                  <SelectItem value="SUPER_ADMIN">
                    {ROLE_LABELS.SUPER_ADMIN}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <DialogFooter className="px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(handleSave)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
