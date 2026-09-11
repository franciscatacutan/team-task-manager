import { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import TeamSwitcher from "./TeamSwitcher";
import { Button } from "../../../components/ui/button";
import NavItem from "./TeamNavItem";
import { cn } from "../../../lib/utils";
import { getUserFromToken } from "@/features/users/api/userApi";
import { getTeamPermissions } from "../utils/teamPermissions";
import { useTeamMe } from "../hooks/useTeamMe";
import type { Team } from "../types/team.type";

export default function TeamSidebar({
  teamKey,
  team,
}: {
  teamKey: string;
  team: Team;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const user = getUserFromToken();
  const { data: teamMe } = useTeamMe(teamKey || "");

  const permissions = getTeamPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(team.deletedAt),
  });
  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-r border-border/60 bg-background/85 backdrop-blur transition-all duration-200",
        collapsed ? "w-18" : "w-50",
      )}
    >
      <div className="relative border-b border-border/60 px-3 py-3">
        <TeamSwitcher teamKey={teamKey} collapsed={collapsed} />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((prev) => !prev)}
          className="absolute -right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-border/60 bg-background shadow-sm hover:bg-muted"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        <NavItem
          to={`/teams/${teamKey}`}
          label="Overview"
          icon={LayoutDashboard}
          collapsed={collapsed}
          end
        />

        <NavItem
          to={`/teams/${teamKey}/projects`}
          label="Projects"
          icon={FolderKanban}
          collapsed={collapsed}
        />

        <NavItem
          to={`/teams/${teamKey}/members`}
          label="Members"
          icon={Users}
          collapsed={collapsed}
        />

        <NavItem
          to={`/teams/${teamKey}/activity`}
          label="Activity"
          icon={Activity}
          collapsed={collapsed}
        />
        {permissions.canAccessTeam && (
          <NavItem
            to={`/teams/${teamKey}/insights`}
            label="Insights"
            icon={BarChart3}
            collapsed={collapsed}
          />
        )}
      </nav>
    </aside>
  );
}
