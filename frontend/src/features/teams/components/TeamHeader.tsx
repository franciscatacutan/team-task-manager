import {
  Clock3,
  //  ShieldCheck,
  Trash2,
  //  UserPlus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/common/utils/dateFormatter";
import EditableField from "../../../common/components/EditableField";
import { useUpdateTeam } from "../hooks/useUpdateTeam";
import type { TeamPermissions } from "../utils/teamPermissions";
import { DeleteTeam } from "./DeleteTeamModal";
import type { Team } from "../types/team.type";

interface Props {
  teamKey: string;
  isLoading: boolean;
  team: Team;
  permissions: TeamPermissions;
}

export default function TeamHeader({
  teamKey,
  isLoading,
  team,
  permissions,
}: Props) {
  const updateTeam = useUpdateTeam(teamKey);
  const ownerName = formatUserName(team.owner);
  const createdByName = formatUserName(team.createdBy);
  const deletedByName = formatUserName(team.deletedBy);
  const isDeleted = Boolean(team.deletedAt);

  if (isLoading) {
    return (
      <header className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-2/3 max-w-md animate-pulse rounded-md bg-muted" />
          </div>

          <div className="h-10 w-28 animate-pulse rounded-xl bg-muted" />
        </div>
      </header>
    );
  }

  return (
    <header className="rounded-xl border border-border/60 bg-background/95 p-4 shadow-sm shadow-slate-900/5">
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Team
              </span>

              {isDeleted ? (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700">
                  <Trash2 className="mr-1 h-3 w-3" />
                  Deleted
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-green-700">
                  Active
                </span>
              )}
            </div>

            <EditableField
              displayClassName="w-full text-xl font-semibold leading-tight tracking-normal text-foreground sm:text-2xl"
              inputClassName="w-full text-xl font-semibold tracking-normal sm:text-2xl"
              value={team.name}
              maxLength={100}
              onSave={(value) => updateTeam.mutate({ name: value })}
              disabled={!permissions.canEditTeamDetails}
            />

            <EditableField
              displayClassName="w-full text-sm leading-6 text-muted-foreground"
              inputClassName="w-full text-sm"
              placeholder="Add a concise team purpose or operating note"
              multiline
              value={team.description}
              maxLength={2000}
              onSave={(value) => updateTeam.mutate({ description: value })}
              disabled={!permissions.canEditTeamDetails}
            />
          </div>

          <div className="flex shrink-0 items-center gap-3 pt-1">
            {permissions.canDeleteTeam && (
              <DeleteTeam teamKey={team.key} teamName={team.name || ""} />
            )}
          </div>
        </div>

        <div className="grid gap-4 border-t border-border/50 pt-3 lg:grid-cols-[minmax(12rem,0.65fr)_minmax(0,2fr)] lg:items-start">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarFallback className="text-xs font-medium">
                {getInitials(team.owner)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Owner
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {ownerName}
              </p>
              {team.owner?.email ? (
                <p className="truncate text-xs text-muted-foreground">
                  {team.owner.email}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <HeaderDetail
              label="Created"
              value={displayDate(team.createdAt)}
              helper={createdByName ? `by ${createdByName}` : "Creator unset"}
            />
            <HeaderDetail
              label="Last activity"
              value={displayDate(team.lastActivityAt)}
              helper={`Updated ${displayDate(team.updatedAt)}`}
              icon={Clock3}
            />
            {/* <HeaderDetail
              label="Members updated"
              value={displayDate(team.membershipChangedAt, "No change yet")}
              helper="Membership changes"
              icon={UserPlus}
            />
            <HeaderDetail
              label="Owner changed"
              value={displayDate(team.ownerChangedAt, "No change yet")}
              helper="Ownership changes"
              icon={ShieldCheck} 
            />*/}
            {isDeleted ? (
              <HeaderDetail
                label="Deleted"
                value={displayDate(team.deletedAt, "No date")}
                helper={deletedByName ? `by ${deletedByName}` : "Archived"}
                icon={Trash2}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

type TeamUser = NonNullable<Team["owner"]>;
type HeaderIcon = typeof Clock3;

function formatUserName(user?: TeamUser | null) {
  if (!user) return "";

  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;
}

function getInitials(user?: TeamUser | null) {
  const first = user?.firstName?.[0] ?? "";
  const last = user?.lastName?.[0] ?? "";
  return `${first}${last}` || "?";
}

function displayDate(date?: string | null, fallback = "Not set") {
  return date ? formatDate(date) : fallback;
}

function HeaderDetail({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: HeaderIcon;
}) {
  return (
    <div className="min-w-0 border-l border-border/60 pl-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
      {helper ? (
        <p className="truncate text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
