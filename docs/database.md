# Database setup and upgrades

The backend reads `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` from its environment. See the [Docker quick start](../README.md#run-locally-with-docker) for bundled and existing PostgreSQL configurations.

## Fresh installation

Create an empty database and a dedicated login with permission to create and update the application's schema. The bundled Compose profile creates that database on first initialization. Spring Boot runs the versioned SQL under `backend/src/main/resources/db/migration`. Hibernate validates the resulting schema, then the app provisions its bootstrap administrator.

The first startup creates `flyway_schema_history`. Later startups validate the migration history and apply pending migrations. Keep the connection settings stable across restarts. PostgreSQL initialization credentials apply only when its data directory is empty.

## Upgrading from an existing installation

1. Identify the exact database and Flyway history in use. Take a full logical backup and verify it can be restored into a separate database. The [local testing guide](local-testing.md#backup-and-restore) covers the bundled rehearsal.
2. If the database already has compatible Flyway history, test the new app against the restored copy. Run schema validation and verify sign-in, task reads and writes, and the migration history before switching over.
3. If the database contains tables but has no Flyway history, v2.0 refuses to initialize it. Keep the old database. Start v2.0 with a separate empty database for a fresh install. If the old records need to carry over, arrange a reviewed migration against a copy and verify the records and permissions before switching connections.
4. For a PostgreSQL 17 minor update, review the release notes for any index or backup maintenance relevant to the existing database. The v2.0 rehearsal verified a same-volume 17.11 to 17.12 update and restoration of a pre-update full backup. [PostgreSQL 17.12 release notes](https://www.postgresql.org/docs/17/release-17-12.html)

Switching an app image does not reverse applied SQL. Keep the original backup and record which app version can open each database copy.

## Adding schema changes

Add a new `V<number>__description.sql` for each change. Flyway validates the checksums of applied files. Test a fresh install and an upgrade from the previous schema with representative records and the normal PostgreSQL integration suite.
