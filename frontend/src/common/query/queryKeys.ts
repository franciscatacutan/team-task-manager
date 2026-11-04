/** One definition for query identities and invalidation prefixes. Full keys include every filter. */
export const queryKeys = {
  session: { current: ["me"] as const },
  users: {
    lists: ["users"] as const,
    list: (params: object) => ["users", params] as const,
    detail: (userId: string) => ["user", userId] as const,
  },
  teams: {
    lists: ["teams"] as const,
    listScope: (memberId?: string) =>
      ["teams", "list", memberId ?? null] as const,
    list: <T extends object>(params: T & { memberId?: string }) =>
      ["teams", "list", params.memberId ?? null, params] as const,
    all: ["teams", "all"] as const,
    details: ["team"] as const,
    detail: (teamKey: string) => ["team", teamKey] as const,
    me: (teamKey: string) => ["team-me", teamKey] as const,
    memberLists: ["teamMembers"] as const,
    members: (teamKey: string) => ["teamMembers", teamKey] as const,
    memberList: (teamKey: string, params: object) =>
      ["teamMembers", teamKey, "list", params] as const,
    memberSelector: (teamKey: string, search: string) =>
      ["teamMembers", teamKey, "selector", search] as const,
    allMemberLists: ["allTeamMembers"] as const,
    allMembers: (teamKey: string) => ["allTeamMembers", teamKey] as const,
    allMemberList: (teamKey: string, search?: string) =>
      ["allTeamMembers", teamKey, search] as const,
    availableUserLists: ["availableUsers"] as const,
    availableUsers: (teamKey: string) => ["availableUsers", teamKey] as const,
    availableUserList: (teamKey: string, search?: string) =>
      ["availableUsers", teamKey, search] as const,
    activityRoot: ["teamActivity"] as const,
    activities: (teamKey: string) => ["teamActivity", teamKey] as const,
    activity: (teamKey: string, params: object) =>
      ["teamActivity", teamKey, params] as const,
    auditsRoot: ["team-audit-logs"] as const,
    audits: (teamKey: string) => ["team-audit-logs", teamKey] as const,
    audit: (teamKey: string, params: object) =>
      ["team-audit-logs", teamKey, params] as const,
    systemEvents: (teamKey: string) => ["team-system-events", teamKey] as const,
    systemEvent: (teamKey: string, params: object) =>
      ["team-system-events", teamKey, params] as const,
    insights: (teamKey: string) => ["team-insights", teamKey] as const,
  },
  projects: {
    listsRoot: ["projects"] as const,
    lists: (teamKey: string) => ["projects", teamKey] as const,
    list: (teamKey: string, params: object) =>
      ["projects", teamKey, params] as const,
    detailsRoot: ["project"] as const,
    details: (teamKey: string) => ["project", teamKey] as const,
    detail: (teamKey: string, projectKey: string) =>
      ["project", teamKey, projectKey] as const,
    activityRoot: ["projectActivities"] as const,
    teamActivities: (teamKey: string) =>
      ["projectActivities", teamKey] as const,
    activities: (teamKey: string, projectKey: string) =>
      ["projectActivities", teamKey, projectKey] as const,
    activity: (teamKey: string, projectKey: string, params: object) =>
      ["projectActivities", teamKey, projectKey, params] as const,
    auditsRoot: ["project-audit-logs"] as const,
    teamAudits: (teamKey: string) => ["project-audit-logs", teamKey] as const,
    audits: (teamKey: string, projectKey: string) =>
      ["project-audit-logs", teamKey, projectKey] as const,
    audit: (teamKey: string, projectKey: string, params: object) =>
      ["project-audit-logs", teamKey, projectKey, params] as const,
    teamSystemEvents: (teamKey: string) =>
      ["project-system-events", teamKey] as const,
    systemEvents: (teamKey: string, projectKey: string) =>
      ["project-system-events", teamKey, projectKey] as const,
    systemEvent: (teamKey: string, projectKey: string, params: object) =>
      ["project-system-events", teamKey, projectKey, params] as const,
    teamInsights: (teamKey: string) => ["project-insights", teamKey] as const,
    insights: (teamKey: string, projectKey: string) =>
      ["project-insights", teamKey, projectKey] as const,
  },
  tasks: {
    listsRoot: ["tasks"] as const,
    teamLists: (teamKey: string) => ["tasks", teamKey] as const,
    lists: (teamKey: string, projectKey: string) =>
      ["tasks", teamKey, projectKey] as const,
    list: (teamKey: string, projectKey: string, params: object) =>
      ["tasks", teamKey, projectKey, params] as const,
    teamBoards: (teamKey: string) => ["tasks", "infinite", teamKey] as const,
    boards: (teamKey: string, projectKey: string) =>
      ["tasks", "infinite", teamKey, projectKey] as const,
    board: (
      teamKey: string,
      projectKey: string,
      status: string,
      params: object,
    ) => ["tasks", "infinite", teamKey, projectKey, status, params] as const,
    detailsRoot: ["task"] as const,
    teamDetails: (teamKey: string) => ["task", teamKey] as const,
    details: (teamKey: string, projectKey: string) =>
      ["task", teamKey, projectKey] as const,
    detail: (teamKey: string, projectKey: string, taskNumber: number) =>
      ["task", teamKey, projectKey, taskNumber] as const,
    activityRoot: ["taskActivities"] as const,
    teamActivities: (teamKey: string) => ["taskActivities", teamKey] as const,
    projectActivities: (teamKey: string, projectKey: string) =>
      ["taskActivities", teamKey, projectKey] as const,
    activities: (teamKey: string, projectKey: string, taskNumber: number) =>
      ["taskActivities", teamKey, projectKey, taskNumber] as const,
    activity: (
      teamKey: string,
      projectKey: string,
      taskNumber: number,
      params: object,
    ) => ["taskActivities", teamKey, projectKey, taskNumber, params] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    inbox: ["notifications", "inbox"] as const,
    inboxPage: (params: object) => ["notifications", "inbox", params] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
};

/** Mutation identity keeps a pending save bound to its original workspace on route changes. */
export const mutationKeys = {
  accountEmail: ["account-email"] as const,
  accountPassword: (user: string) => ["account-password", user] as const,
  userPasswordReset: (user: string) => ["user-password-reset", user] as const,
  teamCreate: ["team-create"] as const,
  teamUpdate: (team: string) => ["team-update", team] as const,
  teamArchive: ["team-archive"] as const,
  membersAdd: (team: string) => ["members-add", team] as const,
  membersRemove: (team: string) => ["members-remove", team] as const,
  memberRole: (team: string) => ["member-role", team] as const,
  ownership: (team: string) => ["ownership", team] as const,
  projectCreate: (team: string) => ["project-create", team] as const,
  projectUpdate: (team: string, project: string) =>
    ["project-update", team, project] as const,
  projectStatus: (team: string) => ["project-status", team] as const,
  projectArchive: (team: string) => ["project-archive", team] as const,
  taskCreate: (team: string, project: string) =>
    ["task-create", team, project] as const,
  taskUpdate: (team: string, project: string, task: number) =>
    ["task-update", team, project, task] as const,
  taskStatus: (team: string, project: string) =>
    ["task-status", team, project] as const,
  taskAssignee: (team: string, project: string, task: number) =>
    ["task-assignee", team, project, task] as const,
  taskSupport: (team: string, project: string, task: number) =>
    ["task-support", team, project, task] as const,
  taskComment: (team: string, project: string, task: number) =>
    ["task-comment", team, project, task] as const,
  taskArchive: (team: string, project: string) =>
    ["task-archive", team, project] as const,
  userAdminUpdate: (user: string) => ["user-admin-update", user] as const,
  userProfile: (user: string) => ["user-profile", user] as const,
  userRole: (user: string) => ["user-role", user] as const,
  notificationDestination: ["notification-destination"] as const,
  notificationRead: ["notification-read"] as const,
  notificationsRead: ["notifications-read"] as const,
};
