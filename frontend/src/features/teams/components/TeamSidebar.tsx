import { useState } from "react";
import { useLocation } from "react-router";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useIsMobile } from "@/common/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { getTeamPermissions } from "../utils/teamPermissions";
import { useTeamMe } from "../hooks/useTeamMe";
import type { Team } from "../types/team.type";
import TeamSwitcher from "./TeamSwitcher";
import TeamNavigation from "./TeamNavigation";

export default function TeamSidebar({
  teamKey,
  team,
}: {
  teamKey: string;
  team: Team;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const mobile = useIsMobile();
  const [drawer, setDrawer] = useState({ open: false, location: location.key });
  const { user } = useAuth();
  const { data: teamMe } = useTeamMe(teamKey);
  const permissions = getTeamPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(team.deletedAt),
  });
  // Route changes and desktop transitions must not resurrect a previously open drawer.
  if (drawer.location !== location.key || (!mobile && drawer.open))
    setDrawer({ open: false, location: location.key });
  const close = () => setDrawer({ open: false, location: location.key });
  if (mobile)
    return (
      <div className="flex shrink-0 items-center gap-3 border-b bg-background px-4 py-2">
        <Dialog
          open={drawer.open && drawer.location === location.key}
          onOpenChange={(open) => setDrawer({ open, location: location.key })}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              aria-label="Open workspace navigation"
              className="h-11 rounded-xl"
            >
              <Menu aria-hidden="true" className="h-4 w-4" />
              <span>Workspace</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="left-0 top-0 flex h-dvh w-[min(20rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 transition-none data-open:slide-in-from-left data-closed:slide-out-to-left data-open:zoom-in-100 data-closed:zoom-out-100">
            <DialogHeader className="shrink-0 border-b px-4 py-5 pr-12">
              <DialogTitle>Workspace navigation</DialogTitle>
              <DialogDescription className="text-foreground/75">
                {team.name}
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b p-3">
                <TeamSwitcher teamKey={teamKey} onNavigate={close} />
              </div>
              <TeamNavigation
                teamKey={teamKey}
                canAccessInsights={permissions.canAccessTeam}
                onNavigate={close}
              />
            </div>
          </DialogContent>
        </Dialog>
        <span className="min-w-0 truncate text-sm font-medium">
          {team.name}
        </span>
      </div>
    );
  return (
    <aside
      aria-label="Team sidebar"
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-border/60 bg-background/85 backdrop-blur transition-[width] duration-200",
        collapsed ? "w-18" : "w-50",
      )}
    >
      <div className="relative border-b border-border/60 px-3 py-3">
        <TeamSwitcher teamKey={teamKey} collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            collapsed
              ? "Expand workspace sidebar"
              : "Collapse workspace sidebar"
          }
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-border/60 bg-background shadow-sm hover:bg-muted"
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
          ) : (
            <ChevronLeft aria-hidden="true" className="h-3 w-3" />
          )}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TeamNavigation
          teamKey={teamKey}
          collapsed={collapsed}
          canAccessInsights={permissions.canAccessTeam}
        />
      </div>
    </aside>
  );
}
