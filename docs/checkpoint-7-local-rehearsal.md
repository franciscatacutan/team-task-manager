# Checkpoint 7 / Phase 2K2 — local preparation

Prepared November 6, 2026 against user commit `b764366`. The user approved local preparation first, one canonical browser origin per running setup, local-IP HTTPS with manual certificate trust, and keeping the existing database untouched. The requested long-term modes are localhost development, LAN testing with multiple users, and later hosted production (provider not chosen).

**Local preparation is user-committed as `055e0f8`. Checkpoint 7 remains open:** live hosting, domain/public TLS, off-host backups, alert delivery, operational ownership and hosting-specific recovery/rollback are not certified. Checkpoint 8's broader release/security/load acceptance is also still pending. No ninth checkpoint is added.

## Choose a mode

| Mode        | Browser address                                         | What runs                                                    | Database/API exposure                                                                                                    |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `Dev`       | `http://localhost:5173` by default                      | Vite in your terminal; isolated Docker backend/PostgreSQL    | Backend `127.0.0.1:18080`, database `127.0.0.1:15433`; development-only gateway network supports those loopback bindings |
| `Rehearsal` | `https://localhost:8443` by default                     | Built frontend/backend, PostgreSQL and Caddy with a local CA | Only the edge port is published, bound to `127.0.0.1`; backend/database stay internal                                    |
| `Lan`       | `https://<your-private-IPv4>:8444` in the example below | Same built stack with an explicit LAN interface/address      | Only that interface's HTTPS edge port is published; manual client trust/firewall setup is required                       |

Every named setup gets its own Compose project, database volume, generated credentials, local CA and refresh-cookie name. That last distinction matters: browser cookies are scoped by host/path, not port. Do not share `.env` files, CA private keys or passwords with test devices. The default application cookie outside this local deployment remains unchanged.

Tabs within one browser profile continue following that profile's account. Use separate browser profiles or devices to test different users in the same setup; this change does not introduce different accounts per tab.

## Prerequisites and boundaries

- Docker engine/Desktop with Compose v2 supporting `up --wait` (verified here with Compose 5.5.1), PowerShell **7.2+**, and curl for `Check`.
- Node 24.15+ and `npm ci` in `frontend` for Vite development. Built rehearsal images use Node 24/Java 21; the backend runtime now runs as UID/GID 10001.
- Use `pwsh`/PowerShell 7, not Windows PowerShell 5.1. The scripts do not change execution policy, firewall, DNS, system/browser trust stores, the root `.env`, the existing Compose stack or its volume.
- Run commands below from the repository root. `local.ps1` always supplies explicit project/config/env paths and pins its generated settings for each invocation so another shell's database variables do not redirect the stack.
- The earlier unmanaged local database is still untouched. These are fresh, separately named databases initialized by Flyway V1/V2. This is not an adoption or transfer of the old test data.

## Localhost development

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name local-dev -Mode Dev
pwsh -File ./deploy/local/local.ps1 -Action Validate -Name local-dev
pwsh -File ./deploy/local/local.ps1 -Action Start -Name local-dev
pwsh -File ./deploy/local/local.ps1 -Action Check -Name local-dev
```

Then, in a separate frontend terminal:

```powershell
cd frontend
npm ci
$env:DEV_API_TARGET = 'http://127.0.0.1:18080'
$env:VITE_API_URL = ''
npm run dev
```

Ensure any existing frontend `.env`/`.env.local` has a blank `VITE_API_URL` for this mode. The launching environment normally takes priority, but an old explicit API URL must not silently keep pointing at a previous backend. `DEV_API_TARGET` is a **launching-shell** variable; it is not a client-exposed Vite variable or automatically read from `.env` by this config. `/api` is proxied without rewriting the browser Origin header.

The configured trusted frontend origin defaults to `http://localhost:5173`; use that hostname consistently rather than alternating with `127.0.0.1`. Backend changes require another `Start` to rebuild the image; Vite updates the frontend during development. For a backend running directly through Maven instead of Docker, use the separately approved [native development setup](native-development.md). It provisions a fresh database and dedicated role in the existing PostgreSQL container, with explicit Maven/Vite settings. Stop competing backends before switching workflows; the original unmanaged database remains intact.

If ports are occupied, choose them during `Init`:

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name alternate-dev -Mode Dev -BackendPort 18081 -DatabasePort 15434 -FrontendPort 5174
```

Use the matching `DEV_API_TARGET` and `npm run dev -- --port 5174`. Vite uses a strict port so it does not quietly move to an origin the backend does not trust.

## Built HTTPS rehearsal

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name desktop-test -Mode Rehearsal -Port 8443
pwsh -File ./deploy/local/local.ps1 -Action Start -Name desktop-test
pwsh -File ./deploy/local/local.ps1 -Action Check -Name desktop-test
```

`Start` builds images, waits for services and exports **only the public CA certificate** to `deploy/local/state/desktop-test/root.crt`. `Check` supplies that certificate to curl explicitly; it does not install trust. On Windows, curl uses best-effort revocation checking for this private local CA, whose public revocation endpoint does not exist; CA-chain and hostname verification remain enabled. There is no `--insecure` shortcut.

To use a normal browser, manually import this public CA into the appropriate device/browser trust store according to its documentation and verify its fingerprint. Some browsers maintain their own certificate store. The script never installs it for you. Remove that test CA from clients when it is no longer needed. Never export or distribute the private CA key in the certificate volume.

Generated bootstrap credentials are in the ignored file `deploy/local/state/desktop-test/environment.env`; open it locally to obtain the administrator email/password. Do not paste it into chat or commit it. A new regular user can register through the existing app flow. There are no baked-in demo accounts, signing secrets or passwords in the images.

## LAN testing with other devices

Find the computer's actual private IPv4 address (`ipconfig` on Windows). Use it explicitly; the address below is an example, not an automatically detected target:

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name home-lan -Mode Lan -HostAddress 192.168.1.50 -Port 8444
pwsh -File ./deploy/local/local.ps1 -Action Validate -Name home-lan
pwsh -File ./deploy/local/local.ps1 -Action Start -Name home-lan
pwsh -File ./deploy/local/local.ps1 -Action Check -Name home-lan
```

Manually trust **that setup's** `state/home-lan/root.crt` on each test device, then open `https://192.168.1.50:8444`. The host computer uses the same address while testing this setup. Devices must be on a network that permits communication; guest Wi-Fi isolation, VPNs and Windows firewall policy can prevent it. If a firewall rule is needed, allow only the chosen private-network interface/port/subnet. No rule, router port forwarding or public exposure is created automatically.

Plain `http://192.168...` is not a supported substitute: the app uses secure-context browser APIs for session coordination. Localhost HTTP is a browser exception; a private-IP HTTP page generally is not. Keep browser/session safeguards enabled.

If DHCP changes the address, deliberately update only `APP_HOST`, `BIND_ADDRESS` and `PUBLIC_ORIGIN` in this named setup's ignored environment file (and port fields if changing ports), then `Validate` and `Start -NoBuild`. Preserve credentials, project identity and volume. Caddy can issue a new leaf certificate under the retained local CA. Do not delete the database or reinitialize credentials to change an address.

**Verification limit:** LAN configuration and private-address validation were checked, but this run did not bind a real LAN interface, install a CA on a phone, change the firewall or test a second physical device. Those manual device/network checks remain before calling LAN access verified on your network.

## Routine operations

| Action     | Meaning                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Init`     | Creates a new named state file and cryptographic credentials. Refuses an existing file rather than rotating credentials behind an existing volume.                                                       |
| `Validate` | Runs Compose's quiet configuration validation without dumping secrets.                                                                                                                                   |
| `Start`    | Builds/starts that isolated project and waits. Use `-NoBuild` when deliberately reusing an already-built local image.                                                                                    |
| `Status`   | Shows only that project's services/status/port bindings.                                                                                                                                                 |
| `Check`    | Verifies backend health, through explicit-CA HTTPS for rehearsal/LAN or loopback HTTP for development.                                                                                                   |
| `ExportCa` | Copies only the public CA certificate; never changes a trust store.                                                                                                                                      |
| `Stop`     | Stops the named project and preserves its containers, volumes, CA and credentials.                                                                                                                       |
| `Backup`   | Writes a PostgreSQL custom-format dump and copies it to the named state's ignored `backups` directory.                                                                                                   |
| `Restore`  | Requires a backup filename and a new `restore_...` database name. Creates that new database; refuses existing targets. It never cleans/drops the source or changes the running application's connection. |

Example:

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Backup -Name desktop-test
pwsh -File ./deploy/local/local.ps1 -Action Restore -Name desktop-test -Archive backup-<timestamp>.dump -TargetDatabase restore_drill
pwsh -File ./deploy/local/local.ps1 -Action Stop -Name desktop-test
```

Replace the archive placeholder with the filename returned by `Backup`. A failed restore can leave its newly created target database for inspection; it never automatically drops it or overwrites it on retry. Use a new target name after reviewing the failure.

Keep dumps private: real backups would contain account hashes, session records and project data. These local copies are **not** encrypted/off-host disaster-recovery backups; no schedule, retention deletion or production recovery target was silently selected. Provider, backup destination/cadence/retention and acceptable data loss/recovery time remain checkpoint-7 hosting decisions.

Docker logs are bounded to three 10 MB files per service. `Check`/`Status` are manual diagnostics, not an external alerting service. For deeper diagnosis, use Docker Desktop or explicit Compose paths for the named project; avoid printing `docker compose config` without `--quiet`, because resolved configuration contains credentials.

Local release tags are recorded in each environment file. `Start` can rebuild that development tag, so this is not an immutable production-release guarantee. Live deployments still need an agreed registry/artifact identity, migration rollout, supported previous release and proven rollback procedure. Do not infer that reverting a container reverses Flyway SQL.

## Controlling files and customization

| File                                                                     | What changed / where to customize                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/api/apiConfig.ts`                                          | Blank/missing API origin resolves to `/api`; explicit API-origin overrides retain support and trailing slashes are normalized.                                                                                                                                              |
| `frontend/src/api/apiClients.ts`                                         | Uses that shared base URL. Authentication/interceptor behavior and the existing cross-tab coordination protocol are retained.                                                                                                                                               |
| `frontend/vite.config.ts`                                                | Loopback-default development, fixed/strict port and `/api` proxy; target comes from the launching shell's `DEV_API_TARGET`.                                                                                                                                                 |
| `frontend/.env.example`, `frontend/.dockerignore`, `frontend/Dockerfile` | Document the blank same-origin default, exclude local environment files from the image context, and support an explicit public API-origin build argument. No frontend secret belongs in a `VITE_` value.                                                                    |
| `frontend/nginx.conf`                                                    | Routes `/api/` to Docker's backend service, preserving the path/Origin; Docker DNS is re-resolved for backend replacement. SPA fallback stays intact.                                                                                                                       |
| `backend/Dockerfile`                                                     | Runs the packaged app as nonroot UID/GID 10001. The isolated stack additionally uses a read-only root filesystem and temporary `/tmp`.                                                                                                                                      |
| `deploy/local/compose.yaml`                                              | Fresh named volumes, nonsuperuser app database role, private application/data networks, generated settings, bounded logs, health checks and Caddy 2.11.9 local TLS. Only edge publishes in HTTPS modes.                                                                     |
| `deploy/local/compose.dev.yaml`                                          | Adds a development-only gateway network and loopback backend/database ports; built frontend/edge are not enabled in this mode.                                                                                                                                              |
| `deploy/local/local.ps1`                                                 | Mode initialization, guarded project selection, startup/checks, public-CA export, backup and non-overwriting restore.                                                                                                                                                       |
| `deploy/local/Caddyfile`                                                 | One HTTPS address, internal `/api` routing and public `/healthz` without detailed Actuator exposure. TLS is local CA only; not public production TLS.                                                                                                                       |
| `deploy/local/init-database.sh`, `restore-database.sh`                   | Parameterized app-role/database initialization and guarded restore to a new database. App role can own/migrate its database but has no global superuser/create-role/create-database privileges. A production migration/runtime privilege split is still a hosting decision. |
| `.gitignore`                                                             | Ignores all generated local state, credentials, certificates and dumps. The old root `.env` and volume are not read or rewritten by the runner.                                                                                                                             |

## Verification

- **546 frontend tests / 55 files pass**, including four API-configuration regressions. TypeScript, strict ESLint, formatting, production Docker builds, syntax/configuration and whitespace checks pass.
- Real browser probes run against both **Vite localhost HTTP** and the **built HTTPS stack**, without intercepted APIs: real registration/login, secure-context browser locks, two independent profiles, same-profile multi-tab reload/refresh, origin rejection and logout isolation. Development cookies are HttpOnly/Lax without Secure; rehearsal cookies retain the existing production HttpOnly/Secure/None policy. Cookie names are isolated by project.
- A separate same-browser-profile test ran Dev and HTTPS rehearsal simultaneously, verifying distinct project cookie names and both database identities after reload.
- HTTPS verification trusts the exported CA explicitly and proves requests fail without it. Browser automation pins the ephemeral server public key for those browser processes only; it does not install system/browser trust or use a global certificate-error bypass. This is distinct from manual trust on real client devices.
- Actual dump/restore matched **all 12 domain tables plus Flyway history** at the backup point, including generated real accounts/sessions and synthetic archived/history/snapshot records. One small local drill took approximately **7.3 seconds** for dump/export/restore; this is an observation, not a production recovery objective. The restored database passed real production-profile application startup/health. A duplicate restore target was refused without rewriting source or target.
- Runtime checks confirm the nonsuperuser database role, nonroot/read-only backend, internal HTTPS-mode backend/database/frontend ports, visible failed dependency health and restart recovery without record changes. Public-IP LAN initialization is rejected; the private-IP template validates. Physical LAN access remains untested here.
- Backend Java/business rules, schema/migrations, authorization, default cookie policy, dependencies and lockfile are unchanged. The preceding 336-pass/one-skip backend suite is **prior checkpoint-6 evidence**, not claimed as rerun here; this checkpoint adds actual container/PostgreSQL/browser operational exercises. Broader role/module/security/load acceptance remains checkpoint 8.

Reproduce browser checks with a temporary external `playwright` installation, the appropriate running named setup, and (for Dev) its running Vite server:

```powershell
$env:TTM_LOCAL_NAME = 'desktop-test'
node frontend/scripts/check-local-deployment.mjs <temporary-playwright-directory>
```

This probe intentionally accepts only generated local state bound to loopback/localhost. It creates synthetic accounts/team records. Do not point it at a real hosted service. No Playwright package was added to application dependencies.

Verification projects/volumes and temporary tooling are removed after evidence is saved; operators can initialize their own named setups using the commands above. The existing development stack/database/volume and trust stores remain untouched. No commit, staging, push, hosting purchase or public deployment was performed.

Suggested user commit: `feat: add isolated local and LAN deployment rehearsal`.

## Still needed to close checkpoint 7

Choose a hosting/provider topology, domain and budget when ready; then verify the actual public HTTPS/origin/cookie configuration, secret provisioning, least-privilege identities, off-host backup schedule/restore, monitoring/alerts, release rollback and operational ownership there. AWS remains a possible future target, not a selected or provisioned account. The portable images/local rehearsal support that later choice without pretending all providers have identical deployment details.

## Primary references checked

- [Vite server/proxy configuration](https://vite.dev/config/server-options), [Web Locks secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).
- [Caddy local HTTPS and trust](https://caddyserver.com/docs/automatic-https), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy 2.11.9 release](https://github.com/caddyserver/caddy/releases/tag/v2.11.9).
- [Docker Compose environment interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [PostgreSQL backup/restore](https://www.postgresql.org/docs/17/backup.html), [curl TLS options](https://curl.se/docs/manpage.html#--ssl-revoke-best-effort).
