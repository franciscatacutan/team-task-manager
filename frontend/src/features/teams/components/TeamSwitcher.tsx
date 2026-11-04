import { useNavigate } from "react-router";
import { ChevronsUpDown, Plus, Check } from "lucide-react";

import { useAllTeams } from "../hooks/useAllTeams";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getTeamPermissions } from "../utils/teamPermissions";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { CreateTeamModal } from "./CreateTeamModal";
import { useState } from "react";
import { Separator } from "../../../components/ui/separator";

interface Props {
  teamKey: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export default function TeamSwitcher({
  teamKey,
  collapsed,
  onNavigate,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canCreateTeam } = getTeamPermissions({ globalRole: user?.role });
  const { data } = useAllTeams();

  const teams = data?.content ?? [];

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const currentTeam = teams.find((t) => t.key === teamKey);

  function switchTeam(id: string) {
    if (id === teamKey) return;

    setOpen(false);
    navigate(`/teams/${id}`);
  }

  function handleCreate() {
    setOpen(false);

    setCreateOpen(true);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label={`Switch team (current: ${currentTeam?.name ?? teamKey})`}
            role="combobox"
            aria-expanded={open}
            variant="ghost"
            className={cn(
              "h-11 w-full rounded-xl border border-border/60 bg-background/75 px-2.5 transition hover:bg-muted/25",
              collapsed ? "justify-center px-0" : "justify-between",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/60">
                <AvatarFallback className="text-[11px] font-semibold text-foreground/75">
                  {currentTeam?.name?.[0] || "T"}
                </AvatarFallback>
              </Avatar>

              {!collapsed && (
                <div className="min-w-0 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Team
                  </div>
                  <span className="block truncate text-sm font-medium">
                    {currentTeam?.name || "Select Team"}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          aria-label="Choose team"
          align="start"
          className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border/60 p-2 shadow-lg"
          onCloseAutoFocus={(event) => {
            if (createOpen) event.preventDefault();
          }}
        >
          <Command label="Search teams" className="space-y-2">
            <CommandInput
              aria-label="Search teams"
              placeholder="Search teams..."
            />

            <CommandList>
              <CommandEmpty>No teams found.</CommandEmpty>

              {teams.map((team) => {
                const isActive = team.key === teamKey;

                return (
                  <CommandItem
                    key={team.key}
                    value={`${team.name} ${team.key}`}
                    onSelect={() => switchTeam(team.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2 py-2",
                      isActive && "bg-muted/60 font-medium",
                    )}
                  >
                    <Avatar className="h-6 w-6 ring-1 ring-border/50">
                      <AvatarFallback className="text-[10px] text-foreground/75">
                        {team.name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <span className="flex-1 text-sm truncate">{team.name}</span>

                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>

          {canCreateTeam && <Separator />}

          {canCreateTeam && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 w-full justify-start gap-2 rounded-xl"
              onClick={handleCreate}
            >
              <Plus className="h-4 w-4" />
              Create Team
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {canCreateTeam && (
        <CreateTeamModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={(team) => {
            onNavigate?.();
            navigate(`/teams/${team.key}`);
          }}
        />
      )}
    </>
  );
}
