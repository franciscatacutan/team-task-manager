import type { QueryClient } from "@tanstack/react-query";
/** Refresh on errors too: a lost response may follow already committed entries. */
export function invalidateMembership(
  client: QueryClient,
  teamKey: string,
  userIds: string[],
) {
  const keys = [
    ["teams"],
    ["team", teamKey],
    ["team-me", teamKey],
    ["teamMembers", teamKey],
    ["allTeamMembers", teamKey],
    ["availableUsers", teamKey],
    ["teamActivity", teamKey],
    ["team-audit-logs", teamKey],
    ["team-insights", teamKey],
    ...userIds.map((id) => ["user", id]),
  ];
  for (const queryKey of keys) void client.invalidateQueries({ queryKey });
}
