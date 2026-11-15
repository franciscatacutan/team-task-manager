# Roles and permissions

Global account roles and team membership roles serve different purposes. A user with global `USER` access can own a team.

| Role         | Scope                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Global admin | View workspaces and Insights across teams, manage permitted user accounts, and create teams. Workspace edits depend on team membership. |
| Super admin  | Global administration plus recovery actions for team ownership and team-admin roles.                                                    |
| Team owner   | Manage team settings, archiving, ownership, and team-admin roles. Manage members, projects, and tasks in the team.                      |
| Team admin   | Manage regular members, pending invitations, projects, and tasks in the team.                                                           |
| Team member  | View active team work and activity. Task assignments and workflow rules control editing permissions.                                    |

Team owners and admins can access their team's Insights, overdue list, and operational logs. Global admins can access them across teams. Members keep access to the Activity feed for work they can view.

Removing a membership ends access granted by that membership. Existing assignments remain available to managers for handoff. Archiving a user ends their sessions and blocks sign-in. See [member handoff](member-handoff.md).
