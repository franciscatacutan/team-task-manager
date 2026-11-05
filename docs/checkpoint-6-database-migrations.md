# Checkpoint 6 / Phase 2K1 — versioned database migrations

Implemented November 5, 2026 against user commit `187d103` (checkpoint 5). The user chose **Flyway with SQL migrations** and **a fresh baseline in separate databases**, keeping the existing test database untouched and planning local cutover separately.

**Checkpoint 6 is verified in that approved scope, awaiting user review/commit. Two release-readiness checkpoints remain (7–8).** Existing unmanaged-database adoption was not selected or certified; production deployment and local cutover were not performed.

## What changed and why

Previously, local Hibernate startup used `update`, production used `validate`, and integration tests used `create-drop`. Those paths did not verify a shared versioned schema. Startup now runs Flyway migrations, records their versions/checksums, then lets Hibernate validate the entity mappings. This is the same schema-management path for local, production and integration tests.

| Location                                                                                         | Responsibility and customization                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/pom.xml`                                                                                | Adds `spring-boot-starter-flyway` and the runtime PostgreSQL Flyway module. Existing Spring Boot 4.1.2 dependency management selects Flyway 12.4.0; there is no independent version override or framework upgrade.                                                                                                           |
| `backend/src/main/resources/db/migration/V1__initial_schema.sql`                                 | Initial 12-table schema, 29 of the current declared indexes, existing primary/unique/check/foreign-key constraints and current field storage. Derived from a disposable Hibernate export, reviewed and given readable foreign-key/unique-constraint names.                                                                   |
| `backend/src/main/resources/db/migration/V2__refresh_session_lookup_index.sql`                   | Adds the thirtieth declared index, `idx_refresh_session_active (family_id, user_id, revoked_at, expires_at)`. This versions the former manual session-index step and supplies a real V1-to-V2 upgrade path. Migration numbers describe the newly established release path, not a reconstructed historical deployment record. |
| `backend/src/main/resources/application.yaml`                                                    | Owns the migration location, checksum/name validation, disabled automatic baselining/clean, disabled basic SQL initialization and shared Hibernate `validate`.                                                                                                                                                               |
| `application-local.yaml`, `application-prod.yaml`                                                | Retain their existing cookie policy. Duplicate schema settings are removed so both inherit the shared migration/validation policy.                                                                                                                                                                                           |
| `backend/src/test/java/com/example/task_manager/support/PostgresIntegrationTest.java`            | Retains disposable PostgreSQL 17, the test profile and test-only credentials, but removes `create-drop`. Existing application integration tests now exercise the actual migrations.                                                                                                                                          |
| `backend/src/test/java/com/example/task_manager/migration/DatabaseMigrationIntegrationTest.java` | Seven dedicated migration/startup scenarios, using its own disposable PostgreSQL 17 container and uniquely named databases.                                                                                                                                                                                                  |
| `backend/src/test/resources/migration/upgrade-fixture.sql`                                       | Synthetic records in every table, loaded explicitly by migration tests only. Not a Flyway location and not packaged in the production JAR.                                                                                                                                                                                   |
| `backend/schema/phase-2e-session-index.sql`                                                      | Retained as a clearly marked legacy reference. Managed databases use V2; do not run both workflows.                                                                                                                                                                                                                          |

Task/project fields remain `name`; UUID identities and public keys keep their existing roles. The baseline preserves JSONB, timestamp precision/time zones, decimal precision, current enum values (including legacy archive values), optimistic-lock versions, task numbering, existing associations and all retained metric/KPI tables. It does not invent relationships for every history/context UUID, add cascades, remove redundant indexes or change business/permission rules. UUID generation, auditing timestamps, initial statuses and counters remain application responsibilities, as before.

## Current startup flow

1. The launcher supplies the intended database connection and application settings.
2. Flyway checks migration history/checksums and applies pending versions in order.
3. Hibernate validates the schema against current entities; it does not create or repair it.
4. Existing configured bootstrap-administrator provisioning runs after initialization, then normal application use can begin.

Fresh databases end at version **2**. Restarting with the same artifact does not repeat either migration. A nonempty schema without Flyway history is refused instead of silently adopted. Changed applied files fail checksum validation. `clean` is disabled. These are application defaults; externally overriding them is an intentional configuration change, not a supported recovery shortcut.

The current startup identity needs the DDL privileges necessary for these migrations. A deployment-specific separate migration identity/job, database provisioning and runtime privilege split belong to checkpoint 7 once its environment is chosen.

V2 deliberately uses ordinary transactional `CREATE INDEX`: this approved fresh-baseline path runs before the new application accepts requests. The earlier concurrent script remains a legacy reference. A future large/live index rollout needs a separately reviewed deployment/migration strategy; do not copy `CONCURRENTLY` into a transactional script without accounting for PostgreSQL's restrictions.

## Existing local database: separate cutover required

**Your current database, `.env`, launch configuration and Compose volume have not been changed. Starting the updated backend against that old nonempty unmanaged schema will fail until a cutover or separately reviewed adoption is arranged.** Do not enable `baseline-on-migrate`, restore Hibernate `update`, delete the volume, or run `clean` to bypass this boundary.

The approved next local-use path is reviewable and reversible:

1. Stop the old backend before changing its connection. Identify its existing database/volume and keep them intact.
2. Provision a separately named empty PostgreSQL database, for example `team_task_manager_flyway_v1`, with appropriate credentials/permissions. This step has not been executed.
3. Point only the intended launcher at that database. Local-host example: `jdbc:postgresql://localhost:5433/team_task_manager_flyway_v1`; inside the current Compose network use the PostgreSQL service host/port, `jdbc:postgresql://postgres:5432/team_task_manager_flyway_v1`. Confirm the actual server/port rather than copying an example blindly.
4. Start the backend; confirm Flyway versions 1 and 2 are successful, Hibernate validation succeeds, `/actuator/health` is UP and the intended account flow works. Only explicitly configured bootstrap provisioning creates an account; no demo data is inserted by migrations.
5. Keep the original database available while evaluating the new installation. Moving old test data later requires a separately reviewed transfer/adoption. If reverting the launcher, use an application version compatible with that original schema; the new artifact deliberately refuses unmanaged schemas.

The current Compose `POSTGRES_DB` variable initializes the official image only for an empty data directory. Changing that variable on the existing persistent volume does not provision another database. Do not remove the volume to force initialization. No Compose recreation, credential rotation or local connection edit is part of the completed verification.

## Adding the next schema change

1. Change the relevant entity and add a new file such as `V3__describe_the_schema_change.sql` under the main migration directory. Use a unique increasing version and two underscores before the description. Coordinate versions across branches before merging.
2. Leave V1/V2 and every already-applied migration unchanged, including comments/formatting. Fresh installations run the full sequence; upgraded installations run only new versions.
3. Add a focused regression for the actual change and upgrade from the previous released version with representative records. Assert required constraints/indexes explicitly; Hibernate validation alone does not certify them.
4. Run backend verification with Docker available, then build the backend image. Use test/disposable databases first. Schema changes that rewrite records, alter permissions/retention or require downtime need explicit review.
5. For each release, inspect pending migrations and determine whether both old and new application versions can use the resulting schema. Plan staged compatible changes when a deployment requires that overlap. The migration tool does not make a destructive change reversible.

Verification commands:

```powershell
cd backend
.\mvnw.cmd -B -ntp clean verify
.\mvnw.cmd -B -ntp '-Dtest=DatabaseMigrationIntegrationTest' test
```

Use `bash ./mvnw` on Linux/macOS. The second command is useful for focused migration work; running it again after a successful unchanged full suite is unnecessary. Existing CI already runs Maven `verify` with Java 21/Docker and builds the backend image, so no duplicate CI job was added. SQL is reviewed as PostgreSQL SQL; Prettier and Google Java Format do not format these SQL files.

## Failure diagnosis and recovery boundaries

| Failure                                   | Review and next action                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection/permission failure             | Verify the intended database, launcher settings and account privileges. Do not change schema/history to work around an incorrect target.                                                                                                                                         |
| Nonempty schema without history           | Stop and confirm the target. Use the approved fresh database or separately review existing-schema adoption; a baseline marker does not prove schema compatibility.                                                                                                               |
| Applied migration checksum mismatch       | Restore the original released migration artifact. Investigate why it changed; do not casually run `repair` or edit history to accept drift. Add a new version for the intended change.                                                                                           |
| Hibernate schema validation failure       | Compare the actual catalog, entity change and delivered migration. Correct the missing migration/drift in a reviewed release; do not switch to automatic `update`.                                                                                                               |
| Failed transactional PostgreSQL migration | Capture the error/history and inspect actual state. The regression proves DDL/data/history rollback for the tested failing script, preserving earlier successful versions. Fix an unapplied script or add the appropriate reviewed correction; retry in a disposable copy first. |
| Failed nontransactional/live operation    | Inspect actual partial effects and locks before recovery. The current transactional test does not certify recovery of every future nontransactional migration.                                                                                                                   |

Flyway normally commits each successful migration separately. Failure of a later version does not undo earlier successful versions. Application rollback and database rollback are different operations; reverting a JAR does not reverse SQL. A real environment requires a verified backup/restore plan before risky changes. Demonstrated backups, restoration, deployment rollback and operational ownership remain checkpoint 7; this checkpoint has not restored or backed up the current database.

## Verification and practical limits

- **Full backend `clean verify`: 337 reported tests, 336 passed, one intentional opt-in profiling skip; zero failures/errors.** Existing integration tests now run on migration-created schemas. Local JDK 25 compiles for Java 21, matching the established local workflow.
- **Seven migration scenarios pass:** fresh production-profile initialization/health and repeat startup; real V1-to-V2 preservation; uniqueness/references/nullability/enum rejection; unmanaged-schema refusal/disabled clean; applied-file checksum failure; transactional DDL rollback; production startup rejection of deliberate schema drift.
- Production-profile catalog checks verify 12 domain tables, all 30 declared index definitions, 12 primary keys, six unique constraints, 25 foreign keys and 15 enum checks. Hibernate validates mapped storage. SQL-state checks exercise all six uniqueness rules plus reference, non-null and enum enforcement.
- Upgrade fixtures preserve the complete JSON representation of every table's record, including archived team/project/task state, counters, versions, microsecond timestamps, read notifications, revoked session data, JSONB history and numeric snapshots. The first migration intentionally lacks the session index, which V2 adds without rewriting rows.
- Backend Docker image builds with Java 21; its packaged JAR includes both migrations and Flyway's PostgreSQL module, and excludes the test fixture. Formatting, documentation-link and Git whitespace checks pass. These are local checks, not a claim that remote CI has run.
- This is actual PostgreSQL-backed migration/application verification, including a live production-profile health request. It is not browser-to-backend end-to-end acceptance, production deployment, arbitrary legacy-schema adoption, a live zero-downtime index rollout, load testing or demonstrated disaster recovery. Frontend source/dependencies were not changed, so the previous checkpoint's frontend/browser results are retained as prior evidence rather than claimed as rerun here.

No real database was connected, reset, baselined or rewritten; only disposable Testcontainers databases were mutated. No environment/secret file, Docker volume, module permission, API, frontend source or application feature was changed. No staging, commit or push was performed.

Suggested user commit: `feat: add Flyway database baseline and migration verification`.

Next approved-plan packages: **checkpoint 7 / 2K2 deployment/operations/recovery**, then **checkpoint 8 / 2K3 real-stack release acceptance**. Both need separate scope decisions/approval. The separate local cutover can be requested when ready; it has not been silently added as a ninth checkpoint or executed during this one.

## Primary references

- [Spring Boot database initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html): Flyway starter/PostgreSQL module, migration naming and one schema initializer.
- [Flyway migration transaction handling](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/migration-transaction-handling): per-migration transactions and nontransactional limitations.
- [PostgreSQL 17 CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html): concurrent index behavior and transaction restrictions.
- [PostgreSQL official image](https://hub.docker.com/_/postgres): initial database configuration and persistent-data initialization behavior.
