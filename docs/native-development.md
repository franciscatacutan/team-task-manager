# Native Maven development on Windows

Prepared November 6, 2026 following the user's explicit approval to create a separate fresh development database and configure native Maven startup. This is local setup, not a production release or a new release checkpoint.

The backend runs through the Maven wrapper on Windows, the frontend runs through Vite, and the existing Docker container supplies PostgreSQL. No Docker backend rebuild is needed for Java changes. The launcher still executes `backend/mvnw.cmd spring-boot:run`; it supplies the intended development configuration instead of inheriting stale Windows database variables.

## Start the app

Run these commands from the repository root. Docker Desktop and the existing `team-task-manager-postgres` container must be running. If that container is stopped, `docker start team-task-manager-postgres` starts it with its existing volume.

Terminal 1:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Backend
```

Terminal 2:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Frontend
```

Open **http://localhost:5173**. Use `localhost` consistently. The backend binds to `127.0.0.1:8080`; Vite forwards `/api` to it. These launchers are for localhost development; use the [LAN HTTPS guide](checkpoint-7-local-rehearsal.md) for testing other devices.

The frontend requires its dependencies once per installation: run `npm ci` in `frontend` if `node_modules` does not exist. Requirements are PowerShell 7.2+, a JDK 21 or newer (the project targets Java 21), Node 24 LTS as specified in `.nvmrc`, and Docker Desktop. The current machine was verified with JDK 25.0.4.1, including a restart using the default Java resolution without an explicit `JAVA_HOME`.

If Java is not resolved correctly, point only this launch at your JDK:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Backend -JavaHome 'C:\Program Files\Java\jdk-25.0.4.1'
```

Use your actual JDK installation path. Health, while the backend is running:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Check
```

Stop each server with Ctrl+C in its terminal; confirm the Windows batch termination prompt if one appears. Stopping Maven/Vite does not remove the database. Stop a competing backend before switching between this native workflow and a Docker backend. Occupied ports are refused; the launcher does not kill other processes.

## Database and sign-in

This machine is already initialized. **Do not run Init again for normal development.**

| Setting                   | Native development value                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| PostgreSQL container      | Existing `team-task-manager-postgres`                                                                             |
| Host endpoint             | `127.0.0.1:5433`                                                                                                  |
| Separate database         | `team_task_manager_native_dev`                                                                                    |
| Dedicated database role   | `ttm_native_dev` — login and database ownership, without superuser, database creation or role creation privileges |
| Browser origin            | `http://localhost:5173`                                                                                           |
| Bootstrap email           | `admin@example.test`                                                                                              |
| Credentials/configuration | `deploy/native/state/environment.env` — generated locally and ignored by Git/Prettier                             |

Open the local configuration file and use **`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`** to sign in. `DB_PASSWORD` is a different credential for PostgreSQL. The bootstrap account is SUPER_ADMIN; the database starts without the legacy users, teams, projects or tasks. Test authentication adds only its normal session records. Passwords and tokens are not printed in launcher output or included in the verification report.

The old `team_task_manager` database stays intact. Its data was not imported, reset or baselined, and its role passwords were not changed. Root `.env`, existing frontend environment files and saved Windows user variables are unchanged. The native database shares the existing PostgreSQL container/volume, so that volume now stores both databases. Keep the volume when stopping/recreating the container; this is separate-database isolation, not a separate server, volume, backup or production environment.

Flyway applies the existing V1/V2 migrations to the fresh database, then Hibernate validates the schema. Subsequent startups validate the history and reuse the data/account. No migration files or application business rules changed. The generated JWT secret/issuer and refresh-cookie name are distinct from the earlier unmanaged setup.

## First initialization on another checkout/machine

Only when no native state exists, with the intended existing PostgreSQL container running and its administrator credentials correctly recorded as `POSTGRES_USER` / `POSTGRES_PASSWORD` in the repository `.env`:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Init
```

Init checks the selected container's published port and refuses existing database/role names before provisioning. It generates a dedicated password, JWT secret and bootstrap password, creates only the new role/database, and writes its ignored state. It does not start/reconfigure Docker, change the administrator password or adopt an existing database. If provisioning is interrupted, a pending credentials file is retained for diagnosis; no database/role is automatically deleted or reset.

For another fresh setup, choose unused names and ports during that first Init:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Init -DatabaseName team_task_manager_other_dev -DatabaseUser ttm_other_dev -DatabasePort 5433 -BackendPort 8081 -FrontendPort 5174
```

Use `-PostgresContainer` if the intended existing PostgreSQL container has a different name. State belongs to this checkout; Backend/Frontend read the saved values, not new Init defaults passed later. Never rerun Init expecting it to rotate passwords or clear test data.

## Files and customization

- [`deploy/native/native.ps1`](../deploy/native/native.ps1) controls provisioning, pinned process settings, the Maven/Vite commands, loopback bindings and health checks. It restores environment variables when a launch returns; it never writes Windows user/machine variables. Database/Flyway settings override inherited values, schema validation stays enabled, and automatic baselining/clean remain disabled.
- `deploy/native/state/environment.env` holds this machine's generated configuration. Ports are read here: change `BACKEND_PORT` while servers are stopped; changing the browser port requires matching `FRONTEND_PORT` and `FRONTEND_URL`. Database URL/name/user/port fields must agree; changing a field does not provision a replacement database or change a PostgreSQL password.
- The Frontend action explicitly sets `VITE_API_URL` to the canonical frontend origin and `DEV_API_TARGET` to the saved backend endpoint. This preserves one browser origin and overrides old frontend `.env` values without editing those files, including shells where empty environment values are removed.
- [`.gitignore`](../.gitignore) and [`.prettierignore`](../.prettierignore) exclude generated native state. Keep the file private; do not stage it or copy its values into source/docs.

## Verification and limits

Verified with the real local PostgreSQL 17 instance: fresh native Maven startup; V1/V2 application and Hibernate validation; bootstrap account creation; health UP; repeat startup with no pending migrations and one existing bootstrap account; dedicated non-superuser role/database ownership; refusal to overwrite existing initialization or start a competing backend; Vite's resolved same-origin API configuration; proxied login, authorized team read, refresh and logout using the isolated cookie/issuer. The HTTP probes exercise the real proxy/backend without mocked API responses; no new browser automation dependency was installed.

Read-only before/after fingerprints verify that all legacy table contents, root/frontend environment files and the pre-existing staged Git index are unchanged. PowerShell syntax, repository formatting and Git whitespace checks pass. No Java/frontend source, migration, dependency or application permission changed, so the previous application suites are retained as previous evidence rather than claimed as rerun here. Verification servers were stopped; the native database/configuration are intentionally retained for development. These checks do not certify physical LAN access, production hosting, load targets or release checkpoints 7–8. No staging, commit or push was performed by the assistant.

Suggested user commit for this setup only: `chore: add isolated native Maven development setup`.
