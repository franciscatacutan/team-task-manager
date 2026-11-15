# Recovering from an accidental project archive

Archiving a project makes the project and its tasks read-only. The project, task workflow statuses, and history remain available to authorized viewers. Project archive recovery is handled by the database operator using a backup from before the archive.

## Operator procedure

1. Record the team key, project key, and time of the archive. Confirm the archive against project activity. Identify the latest trusted backup taken before the action.
2. Preserve the current database. Restore the pre-archive backup into a new database in an isolated environment. Keep the restored environment private and use the app version compatible with the backup's Flyway history. [PostgreSQL backup snapshots](https://www.postgresql.org/docs/17/backup-dump.html)
3. Sign in on the isolated recovery app as an authorized project manager. Check that the project and its tasks that were active at the backup point are editable. Compare workflow status, assignment, and history. Verify that tasks archived before the backup remain archived. Confirm that the source app still points at its original database.
4. Review writes made after the backup across the entire database before choosing a recovery action. Use the restored copy as a reference if recent work must stay in the current system. If the operator and data owner approve switching to the backup, use the deployment's database cutover procedure during a write pause, preserve the current database as the rollback source, and verify the app and affected projects before reopening access.

If a suitable backup is unavailable, keep the archived project as the record and escalate to the operator to review available recovery points. A database dump restores the whole application to its backup point. A cutover would leave newer writes in the preserved source database, including changes in other projects and teams.

## Rehearsal result

Verified on November 15, 2026 with a disposable PostgreSQL 17 stack and the backend at `7ff8d8e`. After restoring the pre-archive backup, the second backend passed its health check and accepted an authenticated sign-in. The recovered project was editable, the active task retained its workflow status and prior activity, and the separately archived task retained its original archive timestamp. Edits on the recovery copy stayed there. A project created after the backup stayed in the source database.

The rehearsal verified recovery into an isolated copy. A hosted cutover still requires target-specific verification.

## Local rehearsal commands

Use a disposable `Dev` environment named `archive-rehearsal` created with the [local rehearsal launcher](local-testing.md). Create a project with an active task and a separately archived task before taking the backup.

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Backup -Name archive-rehearsal
```

Archive the project in that environment and restore the saved backup using a new database name. Replace the backup filename with the one printed by the backup command:

```powershell
pwsh -File ./deploy/local/local.ps1 -Action Restore -Name archive-rehearsal -Archive backup-<timestamp>.dump -TargetDatabase restore_project_archive
```

To verify the restored database through the app, open a fresh PowerShell terminal so Compose can load the named rehearsal's settings. Use a free loopback port for the second backend. The source backend continues to use its original database.

```powershell
docker compose --project-name ttm-local-archive-rehearsal `
  --env-file ./deploy/local/state/archive-rehearsal/environment.env `
  -f deploy/local/compose.yaml -f deploy/local/compose.dev.yaml `
  run --detach --no-deps --name ttm-archive-recovery-check `
  -e DB_URL=jdbc:postgresql://postgres:5432/restore_project_archive `
  -p 127.0.0.1:18081:8080 backend
```

Check `http://127.0.0.1:18081/actuator/health`, then run the checks in step 3 using the original project and task keys. When finished, remove the disposable validation backend with `docker rm -f ttm-archive-recovery-check`.
