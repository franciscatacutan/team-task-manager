import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { TeamMember, RemoveMembersResult } from "../types/team.type";
import { useRemoveMembers } from "../hooks/useRemoveMembers";
import { useMemberBatchSubmission } from "../hooks/useMemberBatchSubmission";
import MemberBatchFeedback from "./MemberBatchFeedback";
import { memberBatchError } from "../utils/memberBatchError";

interface Props {
  teamKey: string;
  open: boolean;
  onClose: () => void;
  member: TeamMember | null;
}

/** Each opening, team, member and login owns its pending state and feedback. */
export default function RemoveMemberModal({ open, member, ...props }: Props) {
  if (!open || !member) return null;
  return (
    <RemoveMemberForm
      key={JSON.stringify([
        props.teamKey,
        member.id,
        authStorage.getRevision(),
      ])}
      {...props}
      member={member}
    />
  );
}

function RemoveMemberForm({
  teamKey,
  member,
  onClose,
}: Omit<Props, "open" | "member"> & { member: TeamMember }) {
  const removeMember = useRemoveMembers(teamKey);
  const submission = useMemberBatchSubmission();
  const [result, setResult] = useState<RemoveMembersResult | null>(null);
  const [requestError, setRequestError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  const isSaving = submission.pending || removeMember.isPending;
  useEffect(() => {
    if (result || requestError)
      feedbackRef.current?.scrollIntoView({ block: "nearest" });
  }, [result, requestError]);

  async function submit() {
    await submission.run(async (isCurrent) => {
      if (!isCurrent()) return;
      setResult(null);
      setRequestError("");
      try {
        const response = await removeMember.mutateAsync({
          userIds: [member.id],
        });
        if (!isCurrent()) return;
        if (response.success.includes(member.id) && !response.failed.length) {
          onClose();
          return;
        }
        setResult(response);
        if (!response.failed.length)
          setRequestError(
            "Unable to confirm removal. Refresh the member list before retrying.",
          );
      } catch (error) {
        if (isCurrent()) setRequestError(memberBatchError(error));
      }
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !submission.inFlight.current) onClose();
      }}
    >
      <DialogContent
        closeDisabled={isSaving}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 transition-none sm:max-w-105"
        onEscapeKeyDown={(event) => {
          if (submission.inFlight.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (submission.inFlight.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>Remove Member</DialogTitle>
          <DialogDescription className="text-foreground/75">
            This removes their team access.
          </DialogDescription>
        </DialogHeader>
        <div
          role="region"
          tabIndex={0}
          aria-label="Removal details"
          aria-busy={isSaving}
          className="min-h-0 space-y-4 overflow-y-auto px-6 py-5 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <p className="text-sm text-foreground/75">
            Are you sure you want to remove{" "}
            <span className="font-medium text-foreground">
              {member.firstName} {member.lastName}
            </span>
            ?
          </p>
          <div ref={feedbackRef}>
            <MemberBatchFeedback
              result={result}
              labels={{ [member.id]: `${member.firstName} ${member.lastName}` }}
              error={requestError}
              verb="Removed"
            />
          </div>
          {isSaving && (
            <p role="status" className="text-sm text-foreground/75">
              Removing {member.firstName} {member.lastName}...
            </p>
          )}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!submission.inFlight.current) onClose();
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="text-foreground"
            onClick={() => void submit()}
            disabled={isSaving}
          >
            {isSaving ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
