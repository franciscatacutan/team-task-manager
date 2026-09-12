import { useDebounce } from "@/common/hooks/useDebounce";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../components/ui/dialog";

import { useAvailableUsers } from "../hooks/useAvailableUsers";
import { AddMemberForm } from "./AddMemberForm";
import { useState } from "react";
import type { TeamRole } from "../types/team.type";

interface Props {
  userTeamRole: TeamRole;
  teamKey: string;
  open: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddMembersModal({
  userTeamRole,
  teamKey,
  open,
  isLoading,
  onOpenChange,
}: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const { data: availableUsersData } = useAvailableUsers(teamKey || "", {
    search: debouncedSearch,
  });

  const users = availableUsersData?.content ?? [];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(42rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] gap-0 rounded-2xl p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        <div className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-base font-semibold">
            Add member
          </DialogTitle>

          <p className="text-sm text-muted-foreground mt-1">
            Invite a user and assign their role
          </p>
        </div>

        <AddMemberForm
          userTeamRole={userTeamRole}
          search={search}
          onSearchChange={setSearch}
          teamKey={teamKey}
          users={users}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
