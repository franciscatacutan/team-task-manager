import { useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Activity, FolderKanban, Sparkles, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { formatDate } from "../../../common/utils/dateFormatter";
import { ActivityItem } from "../../../common/components/activity/ActivityItem";
import {
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../../projects/utils/project.constants";
import { CreateProjectModal } from "../../projects/components/CreateProjectModal";
import { getUserFromToken } from "../../users/api/userApi";
import { useProjects } from "../../projects/hooks/useProjects";
import { useTeamActivities } from "../hooks/useTeamActivities";
import { useTeamMe } from "../hooks/useTeamMe";
import { useTeamMembers } from "../hooks/useTeamMembers";
import AddMembersModal from "./AddMembersModal";
import TeamHeader from "./TeamHeader";
import TeamOverviewCard from "./TeamOverviewCard";
import { getTeamPermissions } from "../utils/teamPermissions";
import type { WorkspaceOutletContext } from "@/layout/workspace/WorkspaceLayout";

export default function TeamOverview() {
  const navigate = useNavigate();
  const { teamKey } = useParams<{ teamKey: string }>();

  // ---------------- STATE ----------------

  const [openCreateTeam, setOpenCreateTeam] = useState(false);
  const [openAddMember, setOpenAddMember] = useState(false);

  // ---------------- DATA ----------------

  const { team } = useOutletContext<WorkspaceOutletContext>();
  const isLoading = false;

  const { data: teamMe } = useTeamMe(teamKey || "");

  const { data: projectsData } = useProjects(teamKey || "", {
    sort: "updatedAt,desc",
    deletedFilter: "ACTIVE",
  });

  const projects = projectsData?.content ?? [];
  const projectCount = projectsData?.totalElements ?? 0;

  // IMPLEMENT STATISTICS
  const { data: activeProjectsData } = useProjects(teamKey || "", {
    status: ["ACTIVE"],
    all: true,
    sort: "updatedAt,desc",
    deletedFilter: "ACTIVE",
  });

  const activeProjectCount = activeProjectsData?.totalElements ?? 0;

  const { data: membersData } = useTeamMembers(teamKey || "", {
    page: 0,
    size: 10,
    sort: "joinedAt,desc",
  });

  const members = membersData?.content ?? [];
  const memberCount = membersData?.totalElements ?? 0;

  const { data: activitiesData } = useTeamActivities(teamKey || "", {
    page: 0,
    size: 5,
    sort: "createdAt,desc",
  });

  const activities = activitiesData?.content ?? [];
  const activityCount = activitiesData?.totalElements ?? 0;

  // ---------------- PERMISSIONS ----------------

  const user = getUserFromToken();

  const permissions = getTeamPermissions({
    globalRole: user?.role,
    teamRole: teamMe?.role,
    isReadOnly: Boolean(team.deletedAt),
  });

  if (isLoading || !team) {
    return (
      <div className="text-sm text-muted-foreground">Loading overview...</div>
    );
  }

  if (!teamKey || !user?.role) {
    return null;
  }

  return (
    <section className="flex flex-1 flex-col gap-4 min-h-0 h-fit">
      <TeamHeader
        isLoading={isLoading}
        teamKey={team.key}
        team={team}
        permissions={permissions}
      />

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <TeamOverviewCard
          title="Projects"
          eyebrow="Portfolio"
          value={String(projectCount)}
          description="View and manage project work."
          icon={FolderKanban}
          onClick={() => navigate(`/teams/${team.key}/projects`)}
        />

        <TeamOverviewCard
          title="Active projects"
          eyebrow="In progress"
          value={String(activeProjectCount)}
          description="See what work is moving now."
          icon={Sparkles}
          onClick={() => navigate(`/teams/${team.key}/projects`)}
        />

        <TeamOverviewCard
          title="Members"
          eyebrow="People"
          value={String(memberCount)}
          description="Review team roles and people."
          icon={Users}
          onClick={() => navigate(`/teams/${team.key}/members`)}
        />

        <TeamOverviewCard
          title="Activity"
          eyebrow="History"
          value={String(activityCount)}
          description="Open the full team history."
          icon={Activity}
          onClick={() => navigate(`/teams/${team.key}/activity`)}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card className="border-border/60 bg-background/92">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">Recent Projects</CardTitle>
            </div>

            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => navigate(`/teams/${team.key}/projects`)}
            >
              View all
            </Button>
          </CardHeader>

          <CardContent className="space-y-2.5">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-sm text-muted-foreground">
                No projects yet. Create the first project to start organizing
                work for this team.
              </div>
            ) : (
              projects.slice(0, 4).map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() =>
                    navigate(`/teams/${team.key}/projects/${project.id}`)
                  }
                  className="cursor-pointer flex w-full items-start justify-between gap-4 rounded-2xl border border-border/60 bg-background px-4 py-2.5 text-left transition hover:border-border hover:bg-muted/20"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="truncate font-medium text-foreground">
                      {project.name}
                    </div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">
                      {project.description?.trim() ||
                        "No description provided."}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated {formatDate(project.updatedAt)}
                    </div>
                  </div>

                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${ProjectStatusStyles[project.status]}`}
                  >
                    {ProjectStatusLabel[project.status]}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="border-border/60 bg-background/92">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Members</CardTitle>
              </div>

              <Button
                variant="ghost"
                className="rounded-xl"
                onClick={() => navigate(`/teams/${team.key}/members`)}
              >
                Manage
              </Button>
            </CardHeader>

            <CardContent className="space-y-2.5">
              {members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                  No members found.
                </div>
              ) : (
                members.slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background px-4 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 ring-1 ring-border/60">
                        <AvatarFallback className="text-[11px]">
                          {member.firstName?.[0]}
                          {member.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {member.teamRole ?? "Member"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-border/60 bg-background/92 mb-4">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </div>

          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => navigate(`/teams/${team.key}/activity`)}
          >
            View full history
          </Button>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-sm text-muted-foreground">
              No recent activity yet.
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-background/70 p-2">
              {activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  item={activity}
                  interactive={Boolean(
                    activity.project?.id && activity.task?.id,
                  )}
                  onOpenTask={
                    activity.project?.id && activity.task?.id
                      ? () =>
                          navigate(
                            `/teams/${team.key}/projects/${activity.project?.id}/tasks/${activity.task?.id}`,
                          )
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProjectModal
        teamKey={team.key}
        open={openCreateTeam}
        onOpenChange={setOpenCreateTeam}
      />

      <AddMembersModal
        userTeamRole={teamMe?.role ?? "MEMBER"}
        teamKey={team.key}
        open={openAddMember}
        isLoading={false}
        onOpenChange={setOpenAddMember}
      />
    </section>
  );
}
