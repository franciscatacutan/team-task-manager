import { ArrowUpDown, Plus } from "lucide-react";
import type { Team } from "../types/team.type";
import type { SortField } from "@/common/types/sort.types";

import {
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  Table,
  TableHead,
} from "@/components/ui/table";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/common/utils/dateFormatter";
import { SortHeader } from "@/common/components/toolbar/SortHeader";

interface Props {
  teams: Team[];
  isLoading: boolean;
  openTeam: (teamKey: string) => void;
  onCreateTeam?: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  canCreateTeam?: boolean;

  sortField: SortField;
  sortOrder: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const SORT_COLUMNS = [
  ["name", "Name"],
  ["owner", "Owner"],
  ["createdAt", "Created"],
  ["lastActivityAt", "Last Activity"],
];

export default function TeamsList({
  teams,
  isLoading,
  openTeam,
  onCreateTeam,
  onClearFilters,
  hasActiveFilters,
  canCreateTeam,
  sortField,
  sortOrder,
  onSort,
}: Props) {
  return (
    <>
      {isLoading ? (
        <div className="flex flex-col min-h-0">
          <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <TableHead key={field} className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {label}
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    {SORT_COLUMNS.map(([key]) => (
                      <TableCell key={key} className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : teams.length > 0 ? (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex flex-1 overflow-auto rounded-2xl border border-border/60 bg-background shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
                <TableRow className="hover:bg-transparent">
                  {SORT_COLUMNS.map(([field, label]) => (
                    <SortHeader
                      label={label}
                      field={field as SortField}
                      sortField={sortField}
                      order={sortOrder}
                      onSort={onSort}
                    />
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {teams.map((team) => (
                  <TableRow
                    key={team.key}
                    onClick={() => openTeam(team.key)}
                    className="group cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="px-4 py-3">
                      <div className="font-medium truncate group-hover:text-primary transition-colors">
                        {team.name}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="truncate text-muted-foreground">
                        {team.owner?.firstName} {team.owner?.lastName}
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(team.createdAt)}
                    </TableCell>

                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {formatDate(team.lastActivityAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {hasActiveFilters ? "No matching teams" : "No teams yet"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Try clearing the search or filters to see more teams."
              : canCreateTeam
                ? "Create a team to get started."
                : "Join a team to get started"}
          </p>

          {hasActiveFilters ? (
            <Button
              variant="outline"
              className="mt-6 rounded-xl"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : canCreateTeam ? (
            <Button className="mt-6 rounded-xl" onClick={onCreateTeam}>
              <Plus className="h-4 w-4" />
              Create team
            </Button>
          ) : null}
        </div>
      )}
    </>
  );
}
