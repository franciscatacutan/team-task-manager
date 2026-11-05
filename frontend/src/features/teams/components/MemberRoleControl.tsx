import { useId, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { mutationKeys } from "@/common/query/queryKeys";
import { requestError } from "@/common/utils/requestError";
import { authStorage } from "@/features/auth/utils/authStorage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAM_ROLE_STYLES, TEAM_ROLE_LABEL } from "../constants/team.constants";
import { useUpdateMemberRole } from "../hooks/useUpdateMemberRole";
import { useMemberBatchSubmission } from "../hooks/useMemberBatchSubmission";
import { cn } from "@/lib/utils";
import type { TeamMember, TeamRole } from "../types/team.type";

interface Props {
  teamKey: string;
  member: TeamMember;
  disabled: boolean;
}
type EditableRole = "ADMIN" | "MEMBER";

// Keep the editable member chip readable without changing unrelated role badges.
function roleStyle(role: TeamRole) {
  return cn(TEAM_ROLE_STYLES[role], role === "MEMBER" && "text-foreground");
}

/** Feedback belongs to this member/workspace/login, independently of other rows. */
export default function MemberRoleControl(props: Props) {
  return (
    <MemberRoleEditor
      key={JSON.stringify([
        props.teamKey,
        props.member.id,
        authStorage.getRevision(),
      ])}
      {...props}
    />
  );
}

function MemberRoleEditor({ teamKey, member, disabled }: Props) {
  const queryClient = useQueryClient();
  const revision = authStorage.getRevision();
  const mutationKey = [...mutationKeys.memberRole(teamKey), revision];
  const anyUpdating = useIsMutating({ mutationKey }) > 0;
  const updateRole = useUpdateMemberRole(teamKey);
  const submission = useMemberBatchSubmission();
  const [failure, setFailure] = useState<{
    role: EditableRole;
    message: string;
  } | null>(null);
  const feedbackId = useId();
  const name = `${member.firstName} ${member.lastName}`;
  const isSaving = submission.pending || updateRole.isPending;
  const locked = disabled || anyUpdating || isSaving;
  const confirmedRole = member.teamRole ?? "MEMBER";

  async function save(role: EditableRole) {
    if (
      disabled ||
      role === confirmedRole ||
      queryClient.isMutating({ mutationKey }) ||
      revision !== authStorage.getRevision() ||
      authStorage.isLoggingOut()
    )
      return;
    await submission.run(async (isCurrent) => {
      if (!isCurrent()) return;
      setFailure(null);
      try {
        await updateRole.mutateAsync({ memberId: member.id, role });
      } catch (error) {
        if (isCurrent())
          setFailure({
            role,
            message: requestError(
              error,
              "Unable to update the team role. Please try again.",
            ),
          });
      }
    });
  }

  return (
    <div className="max-w-64 space-y-2 whitespace-normal">
      <Select
        value={confirmedRole}
        onValueChange={(value) => {
          if (value === "ADMIN" || value === "MEMBER") void save(value);
        }}
        disabled={locked}
      >
        <SelectTrigger
          aria-label={`Team role for ${name}`}
          aria-describedby={isSaving || failure ? feedbackId : undefined}
          aria-busy={isSaving}
          className={`h-9 w-34 rounded-xl border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-none ${roleStyle(confirmedRole)}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(["ADMIN", "MEMBER"] as const).map((role) => (
            <SelectItem key={role} value={role}>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${roleStyle(role)}`}
              >
                {TEAM_ROLE_LABEL[role]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isSaving ? (
        <p
          id={feedbackId}
          role="status"
          className="max-w-64 text-sm text-foreground/75 [overflow-wrap:anywhere]"
        >
          Updating team role for {name}...
        </p>
      ) : (
        failure && (
          <div
            id={feedbackId}
            role="alert"
            className="max-w-64 space-y-2 text-sm [overflow-wrap:anywhere]"
          >
            <p className="text-destructive">
              Could not confirm {name}'s change to{" "}
              {TEAM_ROLE_LABEL[failure.role]}. {failure.message}
            </p>
            {failure.role === confirmedRole ? (
              <p className="text-foreground/75">
                The member list now confirms {TEAM_ROLE_LABEL[confirmedRole]}.
                No retry is needed.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={locked}
                aria-label={`Retry changing team role for ${name} to ${TEAM_ROLE_LABEL[failure.role]}`}
                onClick={() => void save(failure.role)}
              >
                Retry role change
              </Button>
            )}
          </div>
        )
      )}
    </div>
  );
}
