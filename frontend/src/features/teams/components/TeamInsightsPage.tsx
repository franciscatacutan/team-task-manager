import { useParams } from "react-router-dom";

import TeamInsightsDashboard from "./TeamInsightsDashboard";
import TeamObservabilityLogs from "./TeamObservabilityLogs";
import { useTeamInsights } from "../hooks/useTeamInsights";

export default function TeamInsightsPage() {
  const { teamKey } = useParams<{ teamKey: string }>();

  const {
    data: teamInsights,
    isLoading: isTeamInsightsLoading,
    isError: isTeamInsightsError,
  } = useTeamInsights(teamKey || "");

  if (!teamKey) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-background/75 px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">Invalid team</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          This insights route is missing the team identifier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-1 flex-col min-h-0 h-fit">
      <header className="rounded-2xl border border-border/60 bg-linear-to-br from-background via-background to-muted/20 p-5 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Team Insights
        </h1>
        <p className="text-sm text-muted-foreground">
          KPI health, workload flow, and operational records for this team.
        </p>
      </header>

      <TeamInsightsDashboard
        insights={teamInsights}
        isLoading={isTeamInsightsLoading}
        isError={isTeamInsightsError}
      />

      <TeamObservabilityLogs teamKey={teamKey} />
    </div>
  );
}
