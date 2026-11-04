import { useState } from "react";

import { useCurrentUser } from "../features/auth/hooks/useCurrentUser";
import { useUsers } from "../features/users/hooks/useUsers";
import type { User } from "../features/users/types/userType";
import type { UserRole } from "../features/users/types/userRole";
import EditUserDialog from "../features/users/components/EditUserDialog";
import ResetUserPasswordDialog from "../features/users/components/ResetUserPasswordDialog";

import Toolbar from "@/common/components/toolbar/ToolBar";
import { useDebounce } from "@/common/hooks/useDebounce";
import type { SortField, SortOrder } from "@/common/types/sort.types";
import { USER_ROLE_FILTER } from "@/features/users/constants/userFilter.constants";
import { USER_LIST_SORT_OPTIONS } from "@/features/users/constants/user.constants";
import { Pagination } from "@/common/components/pagination/Pagination";
import UsersList from "@/features/users/components/UsersList";
import UsersHeader from "@/features/users/components/UsersHeader";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function UsersPage() {
  // ---------------- STATE ----------------

  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const [search, setSearch] = useState("");

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [roleFilter, setRoleFilter] = useState<UserRole[]>([]);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);

  // ---------------- DERIVED ----------------

  const debouncedSearch = useDebounce(search, 400);
  const sort = `${sortField},${sortOrder}`;

  const filterValues = {
    roleFilter,
  };

  const sortOptions = USER_LIST_SORT_OPTIONS;
  const hasActiveFilters = search.trim().length > 0 || roleFilter.length > 0;

  // ---------------- DATA ----------------

  const { data: currentUser } = useCurrentUser();

  const { data, isError, isLoading, refetch, isPlaceholderData } = useUsers({
    page,
    size,
    search: debouncedSearch,
    sort,
    roles: roleFilter,
  });

  const users = data?.content ?? [];

  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  // Confirmed pages can shrink after role/profile changes; placeholders describe the previous request.
  if (
    data &&
    !isError &&
    !isPlaceholderData &&
    page > Math.max(0, totalPages - 1)
  ) {
    setPage(Math.max(0, totalPages - 1));
  }

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

  const handleToggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleFilterChange = (_key: string, value: string | string[]) => {
    setPage(0);

    // if (key === "deletedFilter") {
    const roles = Array.isArray(value) ? value : value ? [value] : [];

    setRoleFilter(
      roles.filter((role): role is UserRole =>
        ["USER", "ADMIN", "SUPER_ADMIN"].includes(role),
      ),
    );
    // }
  };

  const handleClearFilters = () => {
    setSearch("");
    setRoleFilter([]);
    setPage(0);
  };

  // ------------------ FILTERS ------------------
  const filters = {
    config: USER_ROLE_FILTER,
    values: filterValues,
    onChange: handleFilterChange,
    onClear: handleClearFilters,
  };

  return (
    <div className="min-h-0 h-full bg-muted/10 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 flex-col h-full mx-auto max-w-7xl gap-6">
        <UsersHeader users={users} />

        <Toolbar
          search={{
            label: "Search users",
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
        {isError ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <div>
              <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                Users could not be loaded
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
          <UsersList
            users={users}
            currentUser={currentUser!}
            isLoading={isLoading}
            onClearFilters={handleClearFilters}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            hasActiveFilters={hasActiveFilters}
            editUser={(user) => setEditingUser(user)}
            resetPassword={(user) => setPasswordUser(user)}
            onEditUser={() => setEditOpen(true)}
            onResetPassword={() => setResetOpen(true)}
          />
        )}

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

      <EditUserDialog
        currentUser={currentUser!}
        open={editOpen}
        onOpenChange={setEditOpen}
        user={editingUser}
      />

      <ResetUserPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={passwordUser}
      />
    </div>
  );
}
