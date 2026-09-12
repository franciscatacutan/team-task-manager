import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useUser } from "@/features/users/hooks/useUser";
import { useTeams } from "@/features/teams/hooks/useTeams";
import ProfileHeader from "@/features/users/components/ProfileHeader";
import { useAuth } from "@/features/auth/hooks/useAuth";

import EditUserDialog from "@/features/users/components/EditUserDialog";
import type { User } from "@/features/users/types/userType";
import Toolbar from "@/common/components/toolbar/ToolBar";
import {
  DELETED_FILTER,
  type DeletedFilter,
} from "@/common/types/deletedFilter.types";
import type { SortField, SortOrder } from "@/common/types/sort.types";
import { useDebounce } from "@/common/hooks/useDebounce";
import { TEAM_LIST_SORT_OPTIONS } from "@/features/teams/constants/team.constants";
import { getUserFromToken } from "@/features/users/api/userApi";
import TeamsList from "@/features/teams/components/TeamsList";
import { Pagination } from "@/common/components/pagination/Pagination";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBasePermissions } from "@/common/utils/basePermissions";

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  // ---------------- STATE ----------------

  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(10);

  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState<SortField>("lastActivityAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>("ACTIVE");

  // ---------------- DERIVED ----------------

  const debouncedSearch = useDebounce(search, 400);
  const sort = `${sortField},${sortOrder}`;

  const filterValues = {
    deletedFilter,
  };

  const sortOptions = TEAM_LIST_SORT_OPTIONS;

  const hasActiveFilters =
    search.trim().length > 0 || deletedFilter !== "ACTIVE";

  // ---------------- DATA ----------------

  const { user: currentUser, isLoading: currentUserLoading } = useAuth();

  const profileUserId = userId ?? currentUser?.id ?? "";

  const { data: profileUser, isLoading: profileUserLoading } =
    useUser(profileUserId);

  const isLoading = currentUserLoading || profileUserLoading;

  const isSelf = currentUser?.id === profileUser?.id;

  const {
    data,
    isError,
    isLoading: teamLoading,
    refetch,
  } = useTeams({
    page,
    size,
    search: debouncedSearch,
    sort,
    deletedFilter,
    memberId: profileUserId,
  });

  const teams = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  // ---------------- HANDLERS ----------------
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleSort = (field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        return prevField;
      }

      setSortOrder("desc");
      return field;
    });

    setPage(0);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDeletedFilter("ACTIVE");
    setPage(0);
  };

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleFilterChange = (key: string, value: string | string[]) => {
    setPage(0);

    if (key === "deletedFilter") {
      setDeletedFilter(
        (typeof value === "string" && value
          ? value
          : "ACTIVE") as DeletedFilter,
      );
    }
  };

  const openTeam = (teamKey: string) => {
    navigate(`/teams/${teamKey}`);
  };

  // ---------------- PERMISSIONS ----------------

  const user = getUserFromToken();

  const permissions = getBasePermissions(user?.role);

  const canEditProfile = isSelf || permissions.canManageUsers;

  // ------------------ FILTERS ------------------
  const filters = permissions.canManageTeams
    ? {
        config: DELETED_FILTER,
        values: filterValues,
        onChange: handleFilterChange,
        onDeletedChange: setDeletedFilter,
        onClear: handleClearFilters,
      }
    : undefined;

  return (
    <div className="min-h-0 h-full bg-muted/10 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 flex-col h-full mx-auto max-w-7xl gap-6">
        <ProfileHeader
          user={profileUser}
          isLoading={isLoading}
          isSelf={isSelf}
          canEditProfile={canEditProfile}
          teamCount={totalElements}
          editUser={(user) => setEditingUser(user || null)}
          onEditUser={() => setEditOpen(true)}
        />

        <EditUserDialog
          currentUser={currentUser!}
          open={editOpen}
          onOpenChange={setEditOpen}
          user={editingUser}
          allowEmailEdit={!isSelf && permissions.canManageUsers}
        />

        <Toolbar
          search={{
            value: search,
            onChange: handleSearchChange,
          }}
          filters={filters}
          view={"list"}
          sort={{
            field: sortField,
            order: sortOrder,
            options: sortOptions,
            onFieldChange: handleSort,
            onToggleOrder: handleToggleSortOrder,
          }}
        />
        <section className="flex min-h-0 h-full flex-col gap-3 rounded-2xl border border-border/60 bg-background p-5 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-lg">Teams</div>

              <p className="text-sm text-muted-foreground">
                Current workspaces you both belong to.
              </p>
            </div>

            <div className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs text-muted-foreground">
              {teams?.length ?? 0} Teams
            </div>
          </div>

          {isError ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
              <div>
                <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  Teams could not be loaded
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Check your connection and try again.
                </p>
                <Button
                  className="mt-6 rounded-xl"
                  variant="outline"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <TeamsList
              teams={teams}
              isLoading={teamLoading || isLoading}
              openTeam={openTeam}
              onClearFilters={handleClearFilters}
              hasActiveFilters={hasActiveFilters}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          )}
        </section>

        {totalPages > 1 && (
          <Pagination
            page={page}
            size={size}
            totalPages={totalPages}
            totalElements={totalElements}
            onPageChange={setPage}
            onSizeChange={(size) => {
              setPage(0);
              setSize(size);
            }}
          />
        )}
      </div>
    </div>
  );
}
