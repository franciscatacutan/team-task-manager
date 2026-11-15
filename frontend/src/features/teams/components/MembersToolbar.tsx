import { Search } from "lucide-react";

import { Input } from "../../../components/ui/input";
import type { TeamRole } from "../types/team.type";
import { FilterPopover } from "@/common/components/toolbar/FilterPopover";
import { TEAM_MEMBER_FILTER } from "../constants/teamMember.constants";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  roleFilter: TeamRole[];
  handleFilterChange: (key: string, value: string | string[]) => void;
}

export default function MembersToolbar({
  search,
  onSearchChange,
  roleFilter,
  handleFilterChange,
}: Props) {
  const filterValues = {
    roles: roleFilter,
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-background/92 p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search members"
            placeholder="Search members..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 rounded-xl border-border/70 bg-background pl-9 shadow-none"
          />
        </div>

        <div className="space-y-1">
          <FilterPopover
            label="Roles"
            config={TEAM_MEMBER_FILTER}
            values={filterValues}
            onChange={handleFilterChange}
          />
        </div>
      </div>
    </section>
  );
}
