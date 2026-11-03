import { useState } from "react";
import type { AddMembersResult } from "../types/team.type";
import MemberBatchFeedback from "./MemberBatchFeedback";
import { memberBatchError } from "../utils/memberBatchError";
import { Button } from "../../../components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

import MultiUserSelector from "../../../common/components/MultiUserSelector";
import { Separator } from "../../../components/ui/separator";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useAddMembers } from "../hooks/useAddMembers";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { User } from "../../users/types/userType";
import { cn } from "../../../lib/utils";
import { TEAM_ROLE_STYLES, TEAM_ROLE_LABEL } from "../constants/team.constants";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";

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
  canAssignAdmin: boolean;
  teamKey: string;
  users: User[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberForm({
  canAssignAdmin,
  teamKey,
  users,
  search,
  onSearchChange,
  onOpenChange,
}: Props) {
  const [result, setResult] = useState<AddMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const [knownUsers, setKnownUsers] = useState<Record<string, User>>({});
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

  const onSubmit = (data: FormValues) => {
    setResult(null);
    setRequestError("");
    addMember.mutate(data, {
      onSuccess: (response) => {
        if (
          response.failed.length === 0 &&
          response.success.length === data.members.length
        ) {
          form.reset();
          onOpenChange(false);
          return;
        }
        const succeeded = new Set(response.success.map((member) => member.id));
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
      },
      onError: (error) => setRequestError(memberBatchError(error)),
    });
  };

  function handleSelectedUsersChange(userIds: string[]) {
    setKnownUsers((current) =>
      Object.fromEntries(
        userIds
          .map((id) => [
            id,
            users.find((user) => user.id === id) ?? current[id],
          ])
          .filter((entry): entry is [string, User] => !!entry[1]),
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
      ): entry is { userId: string; role: "ADMIN" | "MEMBER"; user: User } =>
        !!entry,
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="px-6 py-5 space-y-6"
    >
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Users
        </label>

        <Controller
          control={form.control}
          name="members"
          render={() => (
            <MultiUserSelector
              search={search}
              onSearchChange={onSearchChange}
              users={users}
              selectedUsers={selectedUsers.map((entry) => entry.user)}
              disabled={addMember.isPending}
              value={selectedUserIds}
              placeholder="Search and select users..."
              onChange={handleSelectedUsersChange}
            />
          )}
        />

        {form.formState.errors.members && (
          <p className="text-xs text-destructive">
            {form.formState.errors.members.message}
          </p>
        )}
      </div>

      {selectedUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Roles Per User
            </label>

            <span className="text-xs text-muted-foreground sm:text-right">
              New selections default to Member
            </span>
          </div>

          <div className="h-[calc(40vh-2rem)] overflow-y-auto space-y-2 rounded-2xl border border-border/70 bg-muted/20 p-2">
            {selectedUsers.map(({ userId, role, user }) => (
              <div
                key={userId}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3">
                  <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
                    <AvatarFallback className="text-[10px]">
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
                      disabled={addMember.isPending}
                      value={role}
                      onValueChange={(value) =>
                        handleRoleChange(userId, value as "ADMIN" | "MEMBER")
                      }
                    >
                      <SelectTrigger className="h-10 rounded-xl border-border/70 bg-background shadow-none sm:w-36">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="MEMBER">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                              TEAM_ROLE_STYLES.MEMBER,
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
      <MemberBatchFeedback
        result={result}
        labels={labels}
        error={requestError}
        verb="Added"
      />
      <Separator />

      <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          disabled={addMember.isPending}
          onClick={() => onOpenChange(false)}
          className="h-9"
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={selectedCount === 0 || addMember.isPending}
          className="h-9 px-4"
        >
          {addMember.isPending
            ? "Adding..."
            : selectedCount > 0
              ? `Add ${selectedCount} member${selectedCount === 1 ? "" : "s"}`
              : "Add members"}
        </Button>
      </div>
    </form>
  );
}
