# Isolated local testing

Use the launcher for a separate test stack and database volume. It supports Vite development, a built HTTPS rehearsal, and private-LAN testing. Run the commands from the repository root with Docker Compose v2, PowerShell 7.2+ (`pwsh`), and curl. Vite development also requires Node.js 24.15+.

Each name gets separate Docker resources, credentials, and a refresh-cookie name. To test different accounts, use separate browser profiles or devices.

## Built HTTPS rehearsal

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name desktop-test -Mode Rehearsal
pwsh -File ./deploy/local/local.ps1 -Action Start -Name desktop-test
pwsh -File ./deploy/local/local.ps1 -Action Check -Name desktop-test
```

The address is **https://localhost:8443** by default. Use `-Port` during Init to pick a different port. Sign in with the bootstrap credentials in the ignored `deploy/local/state/desktop-test/environment.env`. For teammates, follow [invite-only onboarding](pilot-onboarding.md).

Start exports the public local CA certificate as `deploy/local/state/desktop-test/root.crt`. Check uses that file directly. For browser testing, verify its fingerprint and trust the public certificate in the device or browser trust store. Remove that trust when finished. Keep the generated environment file and CA private key private.

## Private LAN testing

Use the host computer's actual private IPv4 address in place of the example:

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name lan-test -Mode Lan -HostAddress 192.168.1.50 -Port 8444
pwsh -File ./deploy/local/local.ps1 -Action Start -Name lan-test
pwsh -File ./deploy/local/local.ps1 -Action Check -Name lan-test
```

Trust `deploy/local/state/lan-test/root.crt` on each test device and open **https://192.168.1.50:8444** on the host and clients. Allow the selected port only on the intended private network if the host firewall requires it. Guest Wi-Fi and VPNs may isolate devices. Browser session coordination requires HTTPS on a LAN address. Verify the connection from the actual devices you plan to use.

## Vite development

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Init -Name local-dev -Mode Dev
pwsh -File ./deploy/local/local.ps1 -Action Start -Name local-dev
```

Run in a separate terminal:

```powershell
cd frontend
npm ci
$env:DEV_API_TARGET = 'http://127.0.0.1:18080'
npm run dev
```

Leave `VITE_API_URL` blank in any frontend env file so the browser uses the Vite proxy. Open **http://localhost:5173**. If you choose different ports with `-BackendPort`, `-DatabasePort`, or `-FrontendPort` at Init, match the target and Vite port to those settings. Re-run Start to rebuild the backend after Java changes.

## Backup and restore

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Backup -Name desktop-test
pwsh -File ./deploy/local/local.ps1 -Action Restore -Name desktop-test -Archive backup-<timestamp>.dump -TargetDatabase restore_drill
```

Replace the example archive name with the filename returned by Backup. The restore target must be new and start with `restore_`. Restore creates a separate database while the app continues using its source database. The generated dump is a private local copy. See [project archive recovery](project-archive-recovery.md) for checking data in a restored environment.

Use `-Action Stop -Name desktop-test` to stop services and retain their data. `Status` shows services, `Validate` checks configuration, and `ExportCa` exports only the public certificate. Supply the name of the environment you are working on.
