import { Plus } from "lucide-react";
import TeamCard from "./TeamCard";
import { Button } from "@/components/ui/button";
import type { Team } from "../types/team.type";

interface Props {
  teams: Team[];
  isLoading: boolean;
  openTeam: (teamKey: string) => void;
  onCreateTeam: () => void;
  onClearFilters: () => void;
  canCreateTeam: boolean;
  hasActiveFilters: boolean;
}

export default function TeamsBoard({
  teams,
  isLoading,
  openTeam,
  onCreateTeam,
  onClearFilters,
  canCreateTeam,
  hasActiveFilters,
}: Props) {
  return (
    <>
      {isLoading ? (
        <div className="overflow-hidden p-4 rounded-2xl border border-border/60 bg-background shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/25"
              />
            ))}
          </div>
        </div>
      ) : teams.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 rounded-2xl border border-border/60 bg-background shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {teams.map((team) => (
              <TeamCard
                key={team.key}
                team={team}
                onClick={() => openTeam(team.key)}
              />
            ))}
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
              : "Create a team to get started."}
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
