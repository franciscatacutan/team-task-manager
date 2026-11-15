# Changelog

## 2.0.0

### Work management

- Added **My Work** for assigned and supported tasks across teams, plus project filters for assignee, status, priority, and overdue work.
- Added optional project due dates and a team-wide overdue list. Completing a project with open tasks now shows a confirmation.
- Made task creation reliable under concurrent requests and enforced unique names for active projects within a team.
- Improved whole-card desktop dragging, keyboard board movement, mobile navigation, and save and retry feedback.

### Collaboration and access

- Added single-use, email-bound invitations for the production profile, with pending-invite listing and revocation. Added sign-in and signup rate limits.
- Added account archiving and restoration, with session revocation when access ends. Ownership recovery, team administration, and Insights follow the [documented roles](docs/permissions.md).
- Improved notification pagination, unread counts, destination handling, searchable activity, and browser session coordination.

### Setup and compatibility

- Flyway now owns database migrations. Fresh installs start on an empty database. Installations from before Flyway need a separate [database cutover](docs/database.md).
- The Docker quick start supports either bundled PostgreSQL 17.12 or an existing PostgreSQL server. The [local testing guide](docs/local-testing.md) covers isolated localhost and private LAN HTTPS.
- Archived projects and tasks are read-only for authorized viewers. [Project archive recovery](docs/project-archive-recovery.md) uses an operator-managed backup. Password recovery is [admin-assisted](docs/pilot-onboarding.md).

### Verification

The release candidate passed the frontend and backend test suites, both Docker image builds, and Chrome checks for core workflows. The isolated HTTPS pilot handled 1,920 requests from 10 simulated users across 1,000 generated tasks with zero errors and a p95 of 24.1 ms. PostgreSQL backup, restore, and a same-volume 17.11 to 17.12 upgrade passed. These checks cover local use. Validate the exact database, proxy, backups, and alerting if you deploy to a host.
