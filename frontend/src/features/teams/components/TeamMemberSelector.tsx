import { useState, type ComponentProps } from "react";
import UserSelector, {
  type SelectorUser,
} from "@/common/components/UserSelector";
import { useDebounce } from "@/common/hooks/useDebounce";
import { useSelectableTeamMembers } from "../hooks/useSelectableTeamMembers";

interface Props extends Pick<
  ComponentProps<typeof UserSelector>,
  "id" | "aria-describedby" | "aria-invalid" | "aria-required" | "aria-label"
> {
  teamKey: string;
  value?: string;
  selectedUser?: SelectorUser | null;
  placeholder: string;
  excludedUserIds?: string[];
  allowClear?: boolean;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}

/** Current-team choices are searched/paged on the server; selected labels survive new searches. */
export default function TeamMemberSelector({
  teamKey,
  value,
  selectedUser,
  onChange,
  ...props
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<SelectorUser | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const query = useSelectableTeamMembers(
    teamKey,
    debouncedSearch,
    open && !props.disabled,
  );
  const members = Array.from(
    new Map(
      (query.data?.pages.flatMap((page) => page.content) ?? []).map(
        (member) => [member.id, member],
      ),
    ).values(),
  );
  const current =
    selectedUser?.id === value
      ? selectedUser
      : snapshot?.id === value
        ? snapshot
        : undefined;
  return (
    <UserSelector
      {...props}
      users={members}
      value={value}
      selectedUser={current}
      search={search}
      onSearchChange={setSearch}
      onOpenChange={setOpen}
      isLoading={query.isPending || search !== debouncedSearch}
      error={query.isError ? "Unable to load team members." : undefined}
      onRetry={() => void query.refetch()}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      onLoadMore={() => {
        if (!query.isFetchingNextPage && query.hasNextPage)
          void query.fetchNextPage();
      }}
      onChange={(id) => {
        setSnapshot(
          id
            ? (members.find((member) => member.id === id) ?? current ?? null)
            : null,
        );
        onChange(id);
      }}
    />
  );
}
