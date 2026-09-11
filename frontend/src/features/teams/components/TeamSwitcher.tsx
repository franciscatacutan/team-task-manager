import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, Plus, Check } from "lucide-react";

import { useAllTeams } from "../hooks/useAllTeams";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
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
}

export default function TeamSwitcher({ teamKey, collapsed }: Props) {
  const navigate = useNavigate();
  const { data } = useAllTeams();
  
  const teams = data?.content ?? [];

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const currentTeam = teams.find((t) => t.id === teamKey);

  function switchTeam(id: string) {
    if (id === teamKey) return;

    setOpen(false);
    navigate(`/teams/${id}`);
  }

  function handleCreate() {
    setOpen(false);

    setTimeout(() => {
      setCreateOpen(true);
    }, 100);
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-11 w-full rounded-xl border border-border/60 bg-background/75 px-2.5 transition hover:bg-muted/25",
              collapsed ? "justify-center px-0" : "justify-between",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/60">
                <AvatarFallback className="text-[11px] font-semibold">
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
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-72 rounded-2xl border border-border/60 p-2 shadow-lg"
        >
          <Command className="space-y-2">
            <CommandInput placeholder="Search teams..." />

            <CommandList>
              <CommandEmpty>No teams found.</CommandEmpty>

              {teams.map((team) => {
                const isActive = team.key === teamKey;

                return (
                  <CommandItem
                    key={team.key}
                    value={team.key}
                    onSelect={() => switchTeam(team.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-2 py-2",
                      isActive && "bg-muted/60 font-medium",
                    )}
                  >
                    <Avatar className="h-6 w-6 ring-1 ring-border/50">
                      <AvatarFallback className="text-[10px]">
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

          <Separator />

          <Button
            variant="secondary"
            size="sm"
            className="mt-2 w-full justify-start gap-2 rounded-xl"
            onClick={handleCreate}
          >
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTeamModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(team) => {
          navigate(`/teams/${team.key}`);
        }}
      />
    </>
  );
}
