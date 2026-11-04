import { useEffect, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiUserSelector from "@/common/components/MultiUserSelector";
import { cn } from "@/lib/utils";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { UserIdentity } from "@/features/users/types/userType";
import { TEAM_ROLE_STYLES, TEAM_ROLE_LABEL } from "../constants/team.constants";
import { useAddMembers } from "../hooks/useAddMembers";
import { useMemberBatchSubmission } from "../hooks/useMemberBatchSubmission";
import type { AddMembersResult } from "../types/team.type";
import { memberBatchError } from "../utils/memberBatchError";
import MemberBatchFeedback from "./MemberBatchFeedback";

const schema = z.object({
  members: z
    .array(
      z.object({
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER"]),
      }),
    )
    .min(1, "Select at least one user."),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isLoading?: boolean;
  onPendingChange?: (pending: boolean) => void;
  usersError?: boolean;
  isFetchingUsers?: boolean;
  onRetryUsers?: () => unknown;
  canAssignAdmin: boolean;
  teamKey: string;
  users: UserIdentity[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberForm(props: Props) {
  return (
    <MemberFormEditor
      key={JSON.stringify([props.teamKey, authStorage.getRevision()])}
      {...props}
    />
  );
}

function MemberFormEditor({
  isLoading = false,
  onPendingChange,
  usersError,
  isFetchingUsers,
  onRetryUsers,
  canAssignAdmin,
  teamKey,
  users,
  search,
  onSearchChange,
  onOpenChange,
}: Props) {
  const submission = useMemberBatchSubmission(onPendingChange);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<AddMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  useEffect(() => {
    if (result || requestError)
      feedbackRef.current?.scrollIntoView({ block: "start" });
  }, [result, requestError]);
  const [knownUsers, setKnownUsers] = useState<Record<string, UserIdentity>>(
    {},
  );
  const labels = Object.fromEntries(
    [...Object.values(knownUsers), ...users].map((user) => [
      user.id,
      `${user.firstName} ${user.lastName}`,
    ]),
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      members: [],
    },
  });

  const selectedMembers = useWatch({
    control: form.control,
    name: "members",
  });
  const selectedCount = selectedMembers.length;

  const addMember = useAddMembers(teamKey);

  const isSaving = submission.pending || addMember.isPending;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    await submission.run(async (isCurrent) => {
      await form.handleSubmit(async (data) => {
        if (!isCurrent()) return;
        setResult(null);
        setRequestError("");
        try {
          const response = await addMember.mutateAsync(data);
          if (!isCurrent()) return;
          if (
            response.failed.length === 0 &&
            response.success.length === data.members.length
          ) {
            form.reset();
            onOpenChange(false);
            return;
          }
          const succeeded = new Set(
            response.success.map((member) => member.id),
          );
          form.setValue(
            "members",
            data.members.filter((member) => !succeeded.has(member.userId)),
          );
          setResult(response);
          if (
            response.success.length + response.failed.length !==
            data.members.length
          )
            setRequestError(
              "Some changes could not be confirmed. Refresh the member list before retrying.",
            );
        } catch (failure) {
          if (isCurrent()) setRequestError(memberBatchError(failure));
        }
      })(event);
    });
  }

  function handleSelectedUsersChange(userIds: string[]) {
    if (submission.inFlight.current) return;
    setKnownUsers((current) =>
      Object.fromEntries(
        userIds
          .map((id) => [
            id,
            users.find((user) => user.id === id) ?? current[id],
          ])
          .filter((entry): entry is [string, UserIdentity] => !!entry[1]),
      ),
    );
    const currentMembers = form.getValues("members");
    const membersByUserId = new Map(
      currentMembers.map((member) => [member.userId, member]),
    );

    form.setValue(
      "members",
      userIds.map(
        (userId) => membersByUserId.get(userId) ?? { userId, role: "MEMBER" },
      ),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function handleRoleChange(userId: string, role: "ADMIN" | "MEMBER") {
    if (submission.inFlight.current) return;
    form.setValue(
      "members",
      selectedMembers.map((member) =>
        member.userId === userId ? { ...member, role } : member,
      ),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  const selectedUserIds = selectedMembers.map((member) => member.userId);
  const selectedUsers = selectedMembers
    .map((member) => {
      const user =
        users.find((candidate) => candidate.id === member.userId) ??
        knownUsers[member.userId];

      if (!user) return null;

      return {
        ...member,
        user,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        userId: string;
        role: "ADMIN" | "MEMBER";
        user: UserIdentity;
      } => !!entry,
    );

  return (
    <form
      noValidate
      aria-label="Add team members"
      aria-busy={isSaving || isLoading}
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex min-h-0 flex-col"
    >
      <div className="min-h-0 overflow-y-auto px-6 py-5">
        <fieldset
          disabled={isSaving || isLoading}
          className="min-w-0 space-y-6"
        >
          {isLoading && <p role="status">Loading...</p>}
          {usersError && (
            <div role="alert" className="text-sm text-destructive">
              Unable to load available users.{" "}
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || isFetchingUsers}
                onClick={() => {
                  void onRetryUsers?.();
                }}
              >
                Retry loading
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <p
              id="add-members-users-label"
              className="text-xs font-medium text-foreground/75"
            >
              Users
            </p>

            <Controller
              control={form.control}
              name="members"
              render={() => (
                <MultiUserSelector
                  aria-labelledby="add-members-users-label"
                  aria-invalid={Boolean(form.formState.errors.members)}
                  aria-describedby={
                    form.formState.errors.members
                      ? "add-members-users-error"
                      : undefined
                  }
                  search={search}
                  onSearchChange={onSearchChange}
                  users={users}
                  selectedUsers={selectedUsers.map((entry) => entry.user)}
                  disabled={isSaving || isLoading}
                  value={selectedUserIds}
                  placeholder="Search and select users..."
                  onChange={handleSelectedUsersChange}
                />
              )}
            />

            {form.formState.errors.members && (
              <p
                id="add-members-users-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {form.formState.errors.members.message}
              </p>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-foreground/75">
                  Roles per member
                </p>

                <span className="text-xs text-muted-foreground sm:text-right">
                  New selections default to Member
                </span>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-2">
                {selectedUsers.map(({ userId, role, user }) => (
                  <div
                    key={userId}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs sm:flex-row sm:items-center"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                        <AvatarFallback className="text-[10px] text-foreground/75">
                          {user.lastName?.[0]}
                          {user.firstName?.[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    <div className="sm:w-auto">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground sm:hidden">
                        Role
                      </div>
                      {canAssignAdmin ? (
                        <Select
                          disabled={isSaving || isLoading}
                          value={role}
                          onValueChange={(value) =>
                            handleRoleChange(
                              userId,
                              value as "ADMIN" | "MEMBER",
                            )
                          }
                        >
                          <SelectTrigger
                            aria-label={`Role for ${user.firstName} ${user.lastName}`}
                            className="h-10 rounded-xl border-border/70 bg-background shadow-none sm:w-36"
                          >
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>
                            <SelectItem value="MEMBER">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                                  TEAM_ROLE_STYLES.MEMBER,
                                  "text-foreground/75",
                                )}
                              >
                                {TEAM_ROLE_LABEL.MEMBER}
                              </span>
                            </SelectItem>

                            <SelectItem value="ADMIN">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                                  TEAM_ROLE_STYLES.ADMIN,
                                )}
                              >
                                {TEAM_ROLE_LABEL.ADMIN}
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                            TEAM_ROLE_STYLES.MEMBER,
                            "text-foreground/75",
                          )}
                        >
                          {TEAM_ROLE_LABEL.MEMBER}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </fieldset>
        <div ref={feedbackRef} className="mt-6 empty:hidden">
          <MemberBatchFeedback
            result={result}
            labels={labels}
            error={requestError}
            verb="Added"
          />
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 shrink-0 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving}
          onClick={() => {
            if (!submission.inFlight.current) onOpenChange(false);
          }}
          className="h-9"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={selectedCount === 0 || isSaving || isLoading}
          className="h-9 px-4"
        >
          {isSaving
            ? "Adding..."
            : selectedCount > 0
              ? `Add ${selectedCount} member${selectedCount === 1 ? "" : "s"}`
              : "Add members"}
        </Button>
      </DialogFooter>
    </form>
  );
}
