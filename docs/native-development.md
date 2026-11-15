# Native Windows development

Run the Spring Boot backend through Maven and the frontend through Vite. PostgreSQL runs in a Docker container with a loopback port published to Windows.

## First-time setup

1. Install PowerShell 7.2+ (`pwsh`), a JDK 21 or newer, Node.js 24.15+, and Docker Desktop.
2. Start the PostgreSQL container. For a fresh bundled instance, copy `.env.example` to `.env`, set the required credentials, and run `docker compose --profile bundled-postgres up -d --wait postgres` from the repository root. To use another existing container, supply `-PostgresContainer` and its published `-DatabasePort` at initialization.
3. Set `DB_USERNAME` and `DB_PASSWORD` in the repository `.env` to the PostgreSQL administrator credentials for that container. Run `pwsh -File ./deploy/native/native.ps1 -Action Init` from the repository root. The launcher creates a dedicated database and login. If the default `team_task_manager_native_dev` database or `ttm_native_dev` role is in use, choose new names with `-DatabaseName` and `-DatabaseUser`.
4. Run `npm ci` in `frontend` before the first frontend launch.

Init generates credentials in the ignored `deploy/native/state/environment.env` file. Keep that file private. Use the saved state for subsequent starts.

## Run the app

From the repository root, run these in separate terminals:

```powershell
pwsh -File ./deploy/native/native.ps1 -Action Backend
pwsh -File ./deploy/native/native.ps1 -Action Frontend
```

Open **http://localhost:5173** and sign in using the bootstrap credentials from the generated environment file. Vite forwards `/api` to the backend on loopback port 8080. Use Ctrl+C in each terminal to stop it.

Run `pwsh -File ./deploy/native/native.ps1 -Action Check` to verify backend health. If Java resolves to the wrong installation, pass `-JavaHome` with your JDK path to the Backend command. To use alternate ports, select `-BackendPort` and `-FrontendPort` at Init. Keep the browser address consistent with the saved launch configuration. For LAN testing use [local HTTPS](local-testing.md).
