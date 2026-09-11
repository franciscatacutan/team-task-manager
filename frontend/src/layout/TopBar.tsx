import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

import { useAuth } from "../features/auth/hooks/useAuth";

import UserMenu from "./UserMenu";
import { useWorkspaceContext } from "../common/hooks/useWorkspaceContext";
import { CreateProjectModal } from "../features/projects/components/CreateProjectModal";
import { CreateTaskModal } from "../features/tasks/components/CreateTaskModal";
import { CreateTeamModal } from "../features/teams/components/CreateTeamModal";
import AppBreadcrumbs from "../common/components/AppBreadcrumbs";
import NotificationCenter from "../features/notifications/components/NotificationCenter";

export default function TopBar() {
  const { logout } = useAuth();
  const { teamKey, projectId, teamIdPresent, projectIdPresent, permissions } =
    useWorkspaceContext();

  const [openTeam, setOpenTeam] = useState(false);
  const [openProject, setOpenProject] = useState(false);
  const [openTask, setOpenTask] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/75">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/teams"
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:border-border hover:bg-muted/20"
          >
            <span className="rounded-full bg-primary/10 p-1 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            TeamTaskManager
          </Link>
          <AppBreadcrumbs />
        </div>
        <div className="flex items-center gap-2">
          {(permissions.canCreateTeam ||
            permissions.canCreateProject ||
            permissions.canCreateTask) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-9 rounded-xl px-3.5">
                  <Plus className="h-4 w-4" />
                  Create
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={!permissions.canCreateTeam}
                  onClick={() => setOpenTeam(true)}
                >
                  New Team
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!permissions.canCreateProject || !teamIdPresent}
                  onClick={() => setOpenProject(true)}
                >
                  New Project
                </DropdownMenuItem>

                <DropdownMenuItem
                  disabled={!permissions.canCreateTask || !projectIdPresent}
                  onClick={() => setOpenTask(true)}
                >
                  New Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <NotificationCenter />

          <UserMenu onLogout={logout} />
        </div>
      </div>

      <CreateTeamModal open={openTeam} onOpenChange={setOpenTeam} />

      {teamKey && (
        <CreateProjectModal
          teamKey={teamKey}
          open={openProject}
          onOpenChange={setOpenProject}
        />
      )}

      {teamKey && projectId && (
        <CreateTaskModal
          teamKey={teamKey}
          projectId={projectId}
          open={openTask}
          onOpenChange={setOpenTask}
        />
      )}
    </>
  );
}
