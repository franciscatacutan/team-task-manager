import { useState } from "react";
import { useDebounce } from "@/common/hooks/useDebounce";
import { authStorage } from "@/features/auth/utils/authStorage";
import { useAvailableUsers } from "../hooks/useAvailableUsers";
import { AddMemberForm } from "./AddMemberForm";
import MemberBatchDialog from "./MemberBatchDialog";

interface Props {
  canAssignAdmin: boolean;
  teamKey: string;
  open: boolean;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddMembersModal(props: Props) {
  if (!props.open) return null;
  return (
    <AddMembersEditor
      key={JSON.stringify([props.teamKey, authStorage.getRevision()])}
      {...props}
    />
  );
}

function AddMembersEditor({
  canAssignAdmin,
  teamKey,
  isLoading,
  onOpenChange,
}: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const users = useAvailableUsers(teamKey, { search: debouncedSearch });
  return (
    <MemberBatchDialog
      name="Add member"
      description="Invite a user and assign their role"
      onOpenChange={onOpenChange}
    >
      {(onPendingChange) => (
        <AddMemberForm
          canAssignAdmin={canAssignAdmin}
          search={search}
          onSearchChange={setSearch}
          teamKey={teamKey}
          users={users.data?.content ?? []}
          onOpenChange={onOpenChange}
          onPendingChange={onPendingChange}
          isLoading={isLoading}
          usersError={users.isError}
          isFetchingUsers={users.isFetching}
          onRetryUsers={users.refetch}
        />
      )}
    </MemberBatchDialog>
  );
}
