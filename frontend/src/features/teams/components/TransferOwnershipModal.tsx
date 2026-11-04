import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import UserSelector from "@/common/components/UserSelector";
import { useDebounce } from "@/common/hooks/useDebounce";
import { requestError } from "@/common/utils/requestError";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useTransferOwnership } from "../hooks/useTransferOwnership";
import { useTeamMembers } from "../hooks/useTeamMembers";
import type { TeamMember } from "../types/team.type";

interface Props {
  teamKey: string;
  open: boolean;
  onClose: () => void;
  members: TeamMember[];
  preselectedUserId?: string | null;
  isCurrentOwner: boolean;
}

/** Each opening, team and preselected successor gets an independent confirmation. */
export default function TransferOwnershipModal({ open, ...props }: Props) {
  if (!open) return null;
  return (
    <TransferOwnershipForm
      key={JSON.stringify([
        props.teamKey,
        props.preselectedUserId,
        authStorage.getRevision(),
      ])}
      {...props}
    />
  );
}

function TransferOwnershipForm({
  teamKey,
  onClose,
  members,
  preselectedUserId,
  isCurrentOwner,
}: Omit<Props, "open">) {
  const [selected, setSelected] = useState<TeamMember | null>(
    members.find(
      (member) =>
        member.id === preselectedUserId && member.teamRole !== "OWNER",
    ) ?? null,
  );
  const [confirmText, setConfirmText] = useState("");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);
  const inFlight = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const debouncedSearch = useDebounce(search, 300);
  const candidates = useTeamMembers(teamKey, {
    page: 0,
    size: 20,
    search: debouncedSearch,
    sort: "user.lastName,asc",
  });
  const transfer = useTransferOwnership(teamKey);
  const isSaving = pending || transfer.isPending;
  const eligibleMembers = Array.from(
    new Map(
      [...(selected ? [selected] : []), ...(candidates.data?.content ?? [])]
        .filter((member) => member.teamRole !== "OWNER")
        .map((member) => [member.id, member]),
    ).values(),
  );
  const canSubmit = Boolean(
    selected && confirmText === "TRANSFER" && !isSaving,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSubmit || !selected) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    const revision = authStorage.getRevision();
    const isCurrent = () =>
      active.current &&
      revision === authStorage.getRevision() &&
      !authStorage.isLoggingOut();
    try {
      await transfer.mutateAsync(selected.id);
      if (isCurrent()) onClose();
    } catch (failure) {
      if (isCurrent())
        setError(
          requestError(
            failure,
            "Unable to transfer ownership. Please try again.",
          ),
        );
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !inFlight.current) onClose();
      }}
    >
      <DialogContent
        closeDisabled={isSaving}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 transition-none sm:max-w-105"
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-12">
          <DialogTitle>
            {isCurrentOwner ? "Transfer ownership" : "Recover team ownership"}
          </DialogTitle>
          <DialogDescription className="text-foreground/75">
            Choose a current team member as the new owner.
          </DialogDescription>
        </DialogHeader>
        <form
          id="transfer-ownership-form"
          aria-label="Transfer team ownership"
          aria-busy={isSaving}
          onSubmit={(event) => {
            void submit(event);
          }}
          className="min-h-0 overflow-y-auto px-6 py-5"
        >
          <fieldset disabled={isSaving} className="min-w-0 space-y-6">
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-foreground">
              {isCurrentOwner
                ? "You will become a team admin after this transfer."
                : "The current owner will become a team admin. This recovery will be recorded in team activity."}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownership-successor">New owner</Label>
              <UserSelector
                id="ownership-successor"
                aria-label="New owner"
                disabled={isSaving}
                users={eligibleMembers}
                value={selected?.id}
                placeholder="Select new owner"
                search={search}
                onSearchChange={setSearch}
                onChange={(id) =>
                  setSelected(
                    eligibleMembers.find((member) => member.id === id) ?? null,
                  )
                }
              />
              {candidates.isError && (
                <div role="alert" className="text-sm text-destructive">
                  Unable to load team members.
                  <Button
                    type="button"
                    variant="link"
                    disabled={isSaving || candidates.isFetching}
                    onClick={() => void candidates.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownership-confirmation">
                Type TRANSFER to confirm
              </Label>
              <Input
                id="ownership-confirmation"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
              />
            </div>
          </fieldset>
          {error && (
            <p
              ref={errorRef}
              role="alert"
              className="mt-4 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </form>
        <DialogFooter className="mx-0 mb-0 shrink-0 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => {
              if (!inFlight.current) onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="transfer-ownership-form"
            disabled={!canSubmit}
          >
            {isSaving ? "Transferring..." : "Transfer ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
