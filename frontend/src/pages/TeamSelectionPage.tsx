import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, LayoutGrid, LayoutList, RefreshCw } from "lucide-react";

import { useTeams } from "../features/teams/hooks/useTeams";
import { useDebounce } from "../common/hooks/useDebounce";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CreateTeamModal } from "../features/teams/components/CreateTeamModal";
import {
  DELETED_FILTER,
  type DeletedFilter,
} from "../common/types/deletedFilter.types";

import { getTeamPermissions } from "../features/teams/utils/teamPermissions";
import { getUserFromToken } from "../features/users/api/userApi";

import type { SortField, SortOrder } from "@/common/types/sort.types";
import { BASE_SORT_OPTIONS } from "@/common/constants/sort.constants";
import { TEAM_LIST_SORT_OPTIONS } from "@/features/teams/constants/team.constants";

import TeamsBoard from "@/features/teams/components/TeamsBoard";
import TeamsList from "@/features/teams/components/TeamsList";

import { Pagination } from "@/common/components/pagination/Pagination";
import Toolbar from "@/common/components/toolbar/ToolBar";
import TeamSelectionHeader from "@/features/teams/components/TeamSelectionHeader";
import { Button } from "@/components/ui/button";

export default function TeamSelectionPage() {
  const navigate = useNavigate();

  // ---------------- STATE ----------------

  const [open, setOpen] = useState(false);

  const [view, setView] = useState<"board" | "list">("board");

  const getPaginationOptions = (type: "board" | "list") =>
    type === "board" ? [12, 24, 36] : [10, 20, 40];

  const [page, setPage] = useState(0);
  const [size, setSize] = useState<number>(getPaginationOptions("board")[0]);

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

  const sortOptions =
    view === "board" ? BASE_SORT_OPTIONS : TEAM_LIST_SORT_OPTIONS;
  const hasActiveFilters =
    search.trim().length > 0 || deletedFilter !== "ACTIVE";

  // ---------------- DATA ----------------

  const { data, isError, isLoading, refetch } = useTeams({
    page,
    size,
    search: debouncedSearch,
    sort,
    deletedFilter,
  });

  const teams = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? 0;

  // ---------------- HANDLERS ----------------

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const handleViewChange = (value: string) => {
    const nextView = value as "board" | "list";

    setView(nextView);
    setPage(0);
    setSize(getPaginationOptions(nextView)[0]);
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

  const handleClearFilters = () => {
    setSearch("");
    setDeletedFilter("ACTIVE");
    setPage(0);
  };

  const openTeam = (teamKey: string) => {
    navigate(`/teams/${teamKey}`);
  };

  // ---------------- PERMISSIONS ----------------

  const user = getUserFromToken();

  const permissions = getTeamPermissions({
    globalRole: user?.role,
  });

  // ------------------ FILTERS ------------------
  const filters = permissions.canViewDeleteTeam
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
        <TeamSelectionHeader
          totalTeam={totalElements}
          canCreateTeam={permissions.canCreateTeam}
          setOpen={() => setOpen(true)}
        />

        <CreateTeamModal open={open} onOpenChange={setOpen} />

        <Toolbar
          search={{
            value: search,
            onChange: handleSearchChange,
          }}
          filters={filters}
          view={view}
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
          <Tabs
            value={view}
            onValueChange={handleViewChange}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="inline-flex gap-1 rounded-xl border border-border/60 bg-background/70 p-1 shadow-sm">
              <TabsTrigger
                value="board"
                className=" flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </TabsTrigger>
              <TabsTrigger
                value="list"
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground hover:bg-muted transition-all "
              >
                <LayoutList className="h-4 w-4" />
                List
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="board"
              className="flex flex-col flex-1 min-h-0 gap-3"
            >
              <TeamsBoard
                teams={teams}
                isLoading={isLoading}
                openTeam={openTeam}
                onCreateTeam={() => setOpen(true)}
                onClearFilters={handleClearFilters}
                canCreateTeam={permissions.canCreateTeam}
                hasActiveFilters={hasActiveFilters}
              />
            </TabsContent>

            <TabsContent
              value="list"
              className="flex flex-col flex-1 min-h-0 gap-3"
            >
              <TeamsList
                teams={teams}
                isLoading={isLoading}
                openTeam={openTeam}
                onCreateTeam={() => setOpen(true)}
                onClearFilters={handleClearFilters}
                hasActiveFilters={hasActiveFilters}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
                canCreateTeam={permissions.canCreateTeam}
              />
            </TabsContent>
          </Tabs>
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
            options={getPaginationOptions(view)}
          />
        )}
      </div>
    </div>
  );
}
