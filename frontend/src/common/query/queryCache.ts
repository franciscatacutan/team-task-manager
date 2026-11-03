import {
  hashKey,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { authStorage } from "@/features/auth/utils/authStorage";
import type { User } from "@/features/users/types/userType";
import { queryKeys as keys } from "./queryKeys";

/** Cancel an older read before installing the server response; never mutate cached objects. */
export async function setConfirmedData<T>(
  client: QueryClient,
  queryKey: QueryKey,
  data: T,
) {
  const revision = authStorage.getRevision();
  await client.cancelQueries({ queryKey, exact: true });
  if (revision === authStorage.getRevision() && !authStorage.isLoggingOut())
    client.setQueryData(queryKey, data);
}

async function invalidate(client: QueryClient, queryKeys: readonly QueryKey[]) {
  // Await active refetches. Their failure must not turn an already committed save into a failed write.
  await Promise.all(
    queryKeys.map((queryKey) =>
      client.invalidateQueries({ queryKey }, { throwOnError: false }),
    ),
  );
}
const teamChangeKeys = (teamKey: string) => [
  keys.teams.lists,
  keys.teams.detail(teamKey),
  keys.teams.activities(teamKey),
  keys.teams.audits(teamKey),
  keys.teams.systemEvents(teamKey),
  keys.teams.insights(teamKey),
  keys.notifications.all,
];
const projectChangeKeys = (teamKey: string, projectKey?: string) => [
  ...teamChangeKeys(teamKey),
  keys.projects.lists(teamKey),
  ...(projectKey
    ? [
        keys.projects.detail(teamKey, projectKey),
        keys.projects.activities(teamKey, projectKey),
        keys.projects.audits(teamKey, projectKey),
        keys.projects.systemEvents(teamKey, projectKey),
        keys.projects.insights(teamKey, projectKey),
      ]
    : []),
];
const taskListKeys = (teamKey: string, projectKey: string) => [
  keys.tasks.lists(teamKey, projectKey),
  keys.tasks.boards(teamKey, projectKey),
];

export const invalidateTeamChange = (client: QueryClient, teamKey: string) =>
  invalidate(client, teamChangeKeys(teamKey));
export const invalidateProjectChange = (
  client: QueryClient,
  teamKey: string,
  projectKey?: string,
) => invalidate(client, projectChangeKeys(teamKey, projectKey));
export const invalidateTaskChange = (
  client: QueryClient,
  teamKey: string,
  projectKey: string,
  taskNumber?: number,
) =>
  invalidate(client, [
    ...projectChangeKeys(teamKey, projectKey),
    ...taskListKeys(teamKey, projectKey),
    ...(taskNumber === undefined
      ? []
      : [
          keys.tasks.detail(teamKey, projectKey, taskNumber),
          keys.tasks.activities(teamKey, projectKey, taskNumber),
        ]),
  ]);
export const invalidateProjectArchive = (
  client: QueryClient,
  teamKey: string,
  projectKey: string,
) =>
  invalidate(client, [
    ...projectChangeKeys(teamKey, projectKey),
    ...taskListKeys(teamKey, projectKey),
    keys.tasks.details(teamKey, projectKey),
    keys.tasks.projectActivities(teamKey, projectKey),
  ]);
export const invalidateTeamWorkspace = (client: QueryClient, teamKey: string) =>
  invalidate(client, [
    ...teamChangeKeys(teamKey),
    keys.teams.me(teamKey),
    keys.teams.members(teamKey),
    keys.teams.allMembers(teamKey),
    keys.teams.availableUsers(teamKey),
    keys.projects.lists(teamKey),
    keys.projects.details(teamKey),
    keys.projects.teamActivities(teamKey),
    keys.projects.teamAudits(teamKey),
    keys.projects.teamSystemEvents(teamKey),
    keys.projects.teamInsights(teamKey),
    keys.tasks.teamLists(teamKey),
    keys.tasks.teamBoards(teamKey),
    keys.tasks.teamDetails(teamKey),
    keys.tasks.teamActivities(teamKey),
  ]);
export const invalidateMembershipChange = async (
  client: QueryClient,
  teamKey: string,
  userIds: string[],
) => {
  await Promise.all([
    invalidateTeamWorkspace(client, teamKey),
    invalidate(client, userIds.map(keys.users.detail)),
  ]);
};

/** User summaries are embedded across workspaces; the response does not enumerate their team scopes. */
export const invalidateUserChange = (client: QueryClient, userId: string) => {
  const me = client.getQueryData<User>(keys.session.current);
  return invalidate(client, [
    keys.users.detail(userId),
    keys.users.lists,
    ...(!me || me.id === userId ? [keys.session.current] : []),
    keys.teams.lists,
    keys.teams.details,
    keys.teams.memberLists,
    keys.teams.allMemberLists,
    keys.teams.availableUserLists,
    keys.projects.listsRoot,
    keys.projects.detailsRoot,
    keys.tasks.listsRoot,
    keys.tasks.detailsRoot,
    keys.teams.activityRoot,
    keys.projects.activityRoot,
    keys.tasks.activityRoot,
    keys.teams.auditsRoot,
    keys.projects.auditsRoot,
    keys.notifications.all,
  ]);
};
export const invalidateNotifications = (client: QueryClient) =>
  invalidate(client, [keys.notifications.all]);

export const invalidateTeamLists = (client: QueryClient) =>
  invalidate(client, [keys.teams.lists]);

/** Keep pagination smooth within one workspace; never borrow placeholder rows from another. */
export function keepPreviousDataInScope<T>(
  data: T | undefined,
  previous: { queryKey: QueryKey } | undefined,
  scope: QueryKey,
): T | undefined {
  return previous &&
    hashKey(previous.queryKey.slice(0, scope.length)) === hashKey(scope)
    ? data
    : undefined;
}
