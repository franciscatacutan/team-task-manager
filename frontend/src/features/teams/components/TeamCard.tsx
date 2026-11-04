import { Link } from "react-router";
import ArchiveBadge from "@/common/components/ArchiveBadge";
import { Users, ArrowUpRight, CalendarDays } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import type { Team } from "../types/team.type";
import { formatDate } from "../../../common/utils/dateFormatter";

interface Props {
  team: Team;
}

export default function TeamCard({ team }: Props) {
  return (
    <Link
      to={`/teams/${team.key}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="group cursor-pointer overflow-hidden border-border/60 bg-background/95 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md">
        <CardContent className="flex flex-col h-full justify-around">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-2xl border border-border/60 bg-muted/25 p-2 text-muted-foreground transition group-hover:border-border group-hover:text-foreground">
                <Users className="h-4 w-4" />
              </div>

              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Team
                </p>
                <h3 className="truncate text-base font-semibold text-foreground">
                  {team.name}
                  <ArchiveBadge archived={Boolean(team.deletedAt)} />
                </h3>
              </div>
            </div>

            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
          </div>

          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {team.description?.trim() ||
              "No description provided for this team."}
          </p>

          <div className="border-t border-border/60 pt-3 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 ">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/25 ">
                <CalendarDays className="h-3 w-3" />
                Last Activity: {formatDate(team.lastActivityAt)}
              </span>
            </div>

            <div className="flex items-center gap-2 ">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/25 ">
                <CalendarDays className="h-3 w-3" />
                Created: {formatDate(team.createdAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
