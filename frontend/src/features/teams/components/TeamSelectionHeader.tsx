import CreateButton from "@/common/components/CreateButton";
import { Sparkles } from "lucide-react";

interface Props {
  totalTeam: number;
  canCreateTeam: boolean;
  setOpen: () => void;
}

export default function TeamSelectionHeader({
  totalTeam,
  canCreateTeam,
  setOpen,
}: Props) {
  return (
    <section className="rounded-3xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Workspace selection
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Choose a team
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Open an existing workspace or create a new team to start
              organizing projects, members, and activity.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
          <div className="flex shrink-0 items-center gap-3 rounded-xl border px-4 py-2 text-sm">
            <div className="text-xl font-semibold tracking-tight text-foreground">
              {totalTeam}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Teams
            </div>
          </div>

          {canCreateTeam && (
            <CreateButton
              entity="team"
              className="flex-1 sm:flex-none"
              onClick={setOpen}
            />
          )}
        </div>
      </div>
    </section>
  );
}
