# Team Task Manager

Team Task Manager helps teams organize projects and track tickets. Each team has its own projects, and each project contains tasks.

- Manage teams, roles, invitations, and ownership handoffs.
- Plan work with project due dates, task priorities, assignees, and optional support.
- Move tickets on the board with a mouse or keyboard, or use the searchable list. **My Work** brings your assignments together across projects.
- Follow comments, activity, and notifications. Team managers can review Insights, overdue work, and operational logs.

## Run locally with Docker

Install Docker with Compose v2 and keep ports **5173** and **8080** free. The bundled PostgreSQL profile also uses loopback port **5433** by default. Run the commands from the repository root.

1. Copy `.env.example` to `.env`. In PowerShell use `Copy-Item .env.example .env`. In Bash use `cp .env.example .env`.
2. Set `DB_PASSWORD`, an independent random `JWT_SECRET` of at least 32 bytes, and your `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`. Use a bootstrap password with at least eight characters, including upper- and lowercase letters, a digit, and a special character. Keep `.env` private.
3. Choose a database configuration below.
4. Run `docker compose up --build --wait`.
5. Open **http://localhost:5173** and sign in with the bootstrap account. For a startup check, open **http://localhost:8080/actuator/health** or inspect `docker compose logs backend`.

Use `docker compose down` to stop the stack and retain its named volume. Use `localhost` consistently for the app and its configured browser origin.

### Use bundled PostgreSQL

Keep `COMPOSE_PROFILES=bundled-postgres`. Compose starts PostgreSQL 17.12 and waits for it before starting the backend. The database in `DB_URL=jdbc:postgresql://postgres:5432/team_task_manager` must match `DB_NAME`. Inside Docker the backend uses port 5432. Tools outside Docker use the loopback port in `POSTGRES_PORT`.

### Use an existing PostgreSQL server

Set `COMPOSE_PROFILES=` and configure `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` for a dedicated database and login. Start the server and create the empty database first. On Docker Desktop, a server published on the same computer is reachable at `host.docker.internal` using its published port. For a remote server, use a hostname the backend container can reach.

> **Upgrading from v1.0.0?** Flyway requires an empty database for a fresh install or a database with compatible migration history. Keep the old database or volume and read the [database guide](docs/database.md) before starting v2.0 with existing data.

## Development and local testing

| Goal                                                                       | Guide                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Run Maven and Vite directly on Windows                                     | [Native development](docs/native-development.md)                                |
| Run Vite locally with an isolated Docker backend and database              | [Local testing](docs/local-testing.md#vite-development)                         |
| Rehearse a built stack over HTTPS or test from devices on your private LAN | [Local testing](docs/local-testing.md)                                          |
| Invite teammates or help them recover account access                       | [Pilot onboarding](docs/pilot-onboarding.md)                                    |
| Manage role access, member departures, and user archiving                  | [Permissions](docs/permissions.md) and [member handoff](docs/member-handoff.md) |
| Recover from an accidental project archive                                 | [Project archive recovery](docs/project-archive-recovery.md)                    |

The default Docker quick start uses the development profile and accepts local signups. Use the HTTPS rehearsal to try invite-only onboarding. For different users, use separate browser profiles or devices.

## Repository structure

- `frontend/src/features` holds the React and TypeScript modules. Shared controls and query behavior live in `frontend/src/components` and `frontend/src/common`.
- `backend/src/main/java/com/example/task_manager` contains the Spring Boot API, organized by application module.
- `backend/src/main/resources/db/migration` contains the Flyway migrations for PostgreSQL.
- `deploy` contains the optional local launchers and recovery scripts.

## Verify changes

Use Node.js 24.15+ for the frontend and a JDK 21 or newer for the backend. The backend integration tests require Docker and start disposable PostgreSQL containers.

From `frontend`:

```text
npm ci
npm run format:check
npm run lint -- --max-warnings 0
npm test
npm run build
```

From `backend`, run `./mvnw.cmd -B -ntp verify` on Windows or `bash ./mvnw -B -ntp verify` on Linux or macOS. CI also builds both Docker images. To apply formatting, run `npm run format` in the frontend or `spotless:apply` with the Maven wrapper in the backend.

See [what changed in v2.0.0](CHANGELOG.md). Team Task Manager is licensed under [MIT](LICENSE).
