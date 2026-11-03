import ArchiveBadge from "@/common/components/ArchiveBadge";
import { ArrowUpRight, CalendarDays, FolderKanban } from "lucide-react";

import { formatDateTimeShort } from "../../../common/utils/dateFormatter";
import { Avatar, AvatarFallback } from "../../../components/ui/avatar";
import { Card, CardContent } from "../../../components/ui/card";
import type { Project } from "../types/project.types";
import {
  ProjectStatusLabel,
  ProjectStatusStyles,
} from "../utils/project.constants";

interface Props {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: Props) {
  const owner = project.owner ?? project.createdBy;
  const ownerName = `${owner.firstName} ${owner.lastName}`;

  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer overflow-hidden border-border/60 bg-background/95 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
    >
      <CardContent className="flex flex-col h-full justify-around space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/25 p-1.5 text-muted-foreground transition group-hover:border-border group-hover:text-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Project
              </p>
              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                {project.name}
                <ArchiveBadge
                  archived={Boolean(project.deletedAt || project.readOnly)}
                />
              </h3>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${ProjectStatusStyles[project.status]}`}
          >
            {ProjectStatusLabel[project.status]}
          </span>
        </div>

        <p className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">
          {project.description?.trim() ||
            "No description provided for this project."}
        </p>

        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 ">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/25 ">
              <CalendarDays className="h-3 w-3" />
              Last Activity: {formatDateTimeShort(project.lastActivityAt)}
            </span>
          </div>

          <div className="flex items-center gap-2 ">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/25 ">
              <CalendarDays className="h-3 w-3" />
              Created: {formatDateTimeShort(project.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="h-6 w-6 ring-1 ring-border/60">
              <AvatarFallback className="text-[10px]">
                {owner.firstName?.[0]}
                {owner.lastName?.[0]}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Owner
              </div>
              <div className="truncate text-[13px] font-medium text-foreground">
                {ownerName}
              </div>
            </div>
          </div>

          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}
