import { ArrowLeftRight, Minus, Plus, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import type { TeamPermissions } from "../utils/teamPermissions";
import PendingInvitationsDialog from "./PendingInvitationsDialog";

interface Props {
  teamKey: string;
  setRemoveMembersOpen: () => void;
  setAddMembersOpen: () => void;
  setInviteOpen: () => void;
  setTransferOpen: () => void;
  permissions: TeamPermissions;
}

export default function MembersHeader({
  teamKey,
  setRemoveMembersOpen,
  setAddMembersOpen,
  setInviteOpen,
  setTransferOpen,
  permissions,
}: Props) {
  return (
    <header className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Team directory
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Members
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage team roles, ownership, and membership.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {permissions.canAddMember && (
            <Button className="rounded-xl" onClick={setAddMembersOpen}>
              <Plus className="h-4 w-4" />
              Add members
            </Button>
          )}
          {permissions.canAddMember && (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={setInviteOpen}
            >
              Invite new member
            </Button>
          )}
          {permissions.canAddMember && (
            <PendingInvitationsDialog key={teamKey} teamKey={teamKey} />
          )}
          {permissions.canRemoveMember && (
            <Button className="rounded-xl" onClick={setRemoveMembersOpen}>
              <Minus className="h-4 w-4" />
              Remove members
            </Button>
          )}
          {permissions.canTransferOwnership && (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={setTransferOpen}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer ownership
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
