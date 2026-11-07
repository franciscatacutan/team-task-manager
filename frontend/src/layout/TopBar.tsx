import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Link } from "react-router";
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
  const { logout, isLoggingOut } = useAuth();
  const {
    teamKey,
    projectKey,
    teamKeyPresent,
    projectKeyPresent,
    permissions,
  } = useWorkspaceContext();

  const [openTeam, setOpenTeam] = useState(false);
  const [openProject, setOpenProject] = useState(false);
  const [openTask, setOpenTask] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-3 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            to="/teams"
            aria-label="TeamTaskManager"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border/60 bg-background/80 text-sm font-semibold text-foreground transition hover:border-border hover:bg-muted/20 sm:h-9 sm:w-auto sm:px-3"
          >
            <span className="rounded-full bg-primary/10 p-1 text-primary">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span className="hidden sm:inline">TeamTaskManager</span>
          </Link>
          <AppBreadcrumbs />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {(permissions.canCreateTeam ||
            permissions.canCreateProject ||
            permissions.canCreateTask) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Create"
                  title="Create"
                  className="h-11 w-11 gap-2 rounded-xl px-0 sm:h-9 sm:w-auto sm:px-3.5"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem
                  className="min-h-11 rounded-lg sm:min-h-9"
                  disabled={!permissions.canCreateTeam}
                  onClick={() => setOpenTeam(true)}
                >
                  Create team
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11 rounded-lg sm:min-h-9"
                  disabled={!permissions.canCreateProject || !teamKeyPresent}
                  onClick={() => setOpenProject(true)}
                >
                  Create project
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="min-h-11 rounded-lg sm:min-h-9"
                  disabled={!permissions.canCreateTask || !projectKeyPresent}
                  onClick={() => setOpenTask(true)}
                >
                  Create task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <NotificationCenter />

          <UserMenu onLogout={logout} isLoggingOut={isLoggingOut} />
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

      {teamKey && projectKey && (
        <CreateTaskModal
          teamKey={teamKey}
          projectKey={projectKey}
          open={openTask}
          onOpenChange={setOpenTask}
        />
      )}
    </>
  );
}
