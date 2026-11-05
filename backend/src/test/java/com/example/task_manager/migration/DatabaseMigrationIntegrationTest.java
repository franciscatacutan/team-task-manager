package com.example.task_manager.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.task_manager.TeamTaskManagerApplication;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Table;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Actual migration SQL and production startup, isolated from all configured databases. */
class DatabaseMigrationIntegrationTest {
  private static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");
  private static final List<String> TABLES =
      List.of(
          "users",
          "teams",
          "team_members",
          "projects",
          "tasks",
          "refresh_tokens",
          "activity_events",
          "notifications",
          "audit_logs",
          "system_events",
          "metric_snapshots",
          "kpi_snapshots");
  @TempDir Path temporary;

  @BeforeAll
  static void startDisposableDatabase() {
    POSTGRES.start();
  }

  @AfterAll
  static void stopDisposableDatabase() {
    POSTGRES.stop();
  }

  @Test
  void freshProductionStartupMigratesThenValidatesEveryEntityAndServesHealth() throws Exception {
    Database database = newDatabase();
    try (var context = startProduction(database)) {
      var environment = context.getEnvironment();
      assertThat(environment.getActiveProfiles()).containsExactly("prod");
      assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
      Flyway managed = context.getBean(Flyway.class);
      assertThat(managed.getConfiguration().isBaselineOnMigrate()).isFalse();
      assertThat(managed.getConfiguration().isCleanDisabled()).isTrue();
      assertThat(managed.getConfiguration().isValidateOnMigrate()).isTrue();
      assertThat(managed.getConfiguration().isValidateMigrationNaming()).isTrue();
      assertThat(managed.info().current().getVersion().getVersion()).isEqualTo("2");
      assertThat(managed.migrate().migrationsExecuted).isZero();
      assertThat(database.jdbc().queryForObject("select count(*) from users", Integer.class))
          .isZero();
      assertCatalog(context, database.jdbc());
      int port = ((WebServerApplicationContext) context).getWebServer().getPort();
      try (HttpClient client = HttpClient.newHttpClient()) {
        var response =
            client.send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/actuator/health"))
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"status\":\"UP\"");
      }
    }
    // A second complete application startup must reuse history, never recreate the schema.
    seed(database);
    var original = snapshot(database);
    try (var context = startProduction(database)) {
      assertThat(context.getBean(Flyway.class).migrate().migrationsExecuted).isZero();
      assertThat(snapshot(database)).isEqualTo(original);
    }
  }

  @Test
  void upgradingV1ToV2PreservesEveryTableIncludingArchivedHistoryAndSessions() {
    Database database = newDatabase();
    assertThat(flyway(database, "1").migrate().migrationsExecuted).isEqualTo(1);
    seed(database);
    var original = snapshot(database);
    assertThat(original).hasSize(12);
    assertThat(original.values()).allSatisfy(rows -> assertThat(rows).hasSize(1));
    assertThat(
            database
                .jdbc()
                .queryForObject(
                    "select count(*) from pg_indexes where indexname = 'idx_refresh_session_active'",
                    Integer.class))
        .isZero();
    Flyway latest = flyway(database, null);
    assertThat(latest.migrate().migrationsExecuted).isEqualTo(1);
    assertThat(snapshot(database)).isEqualTo(original);
    assertThat(
            database
                .jdbc()
                .queryForObject(
                    "select indexdef from pg_indexes where indexname = 'idx_refresh_session_active'",
                    String.class))
        .contains("(family_id, user_id, revoked_at, expires_at)");
    assertThat(latest.migrate().migrationsExecuted).isZero();
    assertThat(latest.info().applied()).hasSize(2);
    latest.validate();
  }

  @Test
  void databaseEnforcesAllSixUniquenessRulesAndRequiredReferencesValuesAndEnums() {
    Database database = newDatabase();
    flyway(database, null).migrate();
    seed(database);
    var jdbc = database.jdbc();
    for (String statement :
        List.of(
            "insert into users (id,first_name,last_name,email,password,role,created_at,updated_at,version) select ?,'Copy','User',email,password,role,created_at,updated_at,0 from users",
            "insert into teams (id,owner_id,name,team_key,created_at,version) select ?,owner_id,name,team_key,created_at,0 from teams",
            "insert into projects (id,team_id,owner_id,name,project_key,status,next_task_number,created_at,updated_at,version) select ?,team_id,owner_id,name,project_key,status,next_task_number,created_at,updated_at,0 from projects",
            "insert into tasks (id,project_id,assignee_id,name,task_number,priority,status,created_at,updated_at,version) select ?,project_id,assignee_id,name,task_number,priority,status,created_at,updated_at,0 from tasks",
            "insert into team_members (id,team_id,user_id,added_by,role,joined_at,version) select ?,team_id,user_id,added_by,role,joined_at,0 from team_members",
            "insert into refresh_tokens (id,user_id,token_hash,family_id,created_at,expires_at) select ?,user_id,token_hash,family_id,created_at,expires_at from refresh_tokens")) {
      assertSqlState(() -> jdbc.update(statement, UUID.randomUUID()), "23505");
    }
    assertSqlState(
        () -> jdbc.update("update tasks set assignee_id = ?", UUID.randomUUID()), "23503");
    assertSqlState(() -> jdbc.update("update tasks set name = null"), "23502");
    assertSqlState(() -> jdbc.update("update users set role = 'UNKNOWN_ROLE'"), "23514");
    assertSqlState(() -> jdbc.update("delete from users"), "23503");
    assertThat(jdbc.queryForObject("select role from users", String.class))
        .isEqualTo("SUPER_ADMIN");
  }

  @Test
  void nonemptyUnmanagedDatabaseIsRejectedAndCleanIsDisabled() {
    Database database = newDatabase();
    database.jdbc().execute("create table legacy_marker (value text not null)");
    database.jdbc().update("insert into legacy_marker values ('keep existing data')");
    Flyway migrations = flyway(database, null);
    assertThatThrownBy(migrations::migrate)
        .isInstanceOf(FlywayException.class)
        .hasMessageContaining("non-empty schema");
    assertThatThrownBy(migrations::clean)
        .isInstanceOf(FlywayException.class)
        .hasMessageContaining("disabled");
    assertThat(database.jdbc().queryForObject("select value from legacy_marker", String.class))
        .isEqualTo("keep existing data");
    assertThat(database.jdbc().queryForObject("select to_regclass('users')", String.class))
        .isNull();
  }

  @Test
  void changingAnAppliedMigrationFailsChecksumValidation() throws IOException {
    Database database = newDatabase();
    for (String name : List.of("V1__initial_schema.sql", "V2__refresh_session_lookup_index.sql")) {
      Files.writeString(
          temporary.resolve(name),
          new ClassPathResource("db/migration/" + name).getContentAsString(StandardCharsets.UTF_8));
    }
    Flyway migrations = configured(database, "filesystem:" + temporary);
    migrations.migrate();
    Path baseline = temporary.resolve("V1__initial_schema.sql");
    String original = Files.readString(baseline);
    Files.writeString(baseline, original + "\n-- An applied migration must not be edited.\n");
    assertThatThrownBy(migrations::migrate)
        .isInstanceOf(FlywayException.class)
        .hasMessageContaining("checksum mismatch");
    // Restore the original artifact; do not mask the mismatch with repair.
    Files.writeString(baseline, original);
    migrations.validate();
    assertThat(migrations.migrate().migrationsExecuted).isZero();
  }

  @Test
  void failingTransactionalUpgradeRollsBackDdlAndPreservesDataAndHistory() throws IOException {
    Database database = newDatabase();
    Flyway valid = flyway(database, null);
    valid.migrate();
    seed(database);
    var original = snapshot(database);
    Files.writeString(
        temporary.resolve("V3__deliberate_test_failure.sql"),
        """
        CREATE TABLE should_rollback (id integer PRIMARY KEY);
        INSERT INTO deliberately_missing_table VALUES (1);
        """);
    assertThatThrownBy(
            () ->
                configured(database, "classpath:db/migration", "filesystem:" + temporary).migrate())
        .isInstanceOf(FlywayException.class);
    assertThat(
            database.jdbc().queryForObject("select to_regclass('should_rollback')", String.class))
        .isNull();
    assertThat(snapshot(database)).isEqualTo(original);
    assertThat(valid.info().applied()).hasSize(2);
    valid.validate();
  }

  @Test
  void productionRejectsSchemaDriftInsteadOfSilentlyRepairingIt() {
    Database database = newDatabase();
    flyway(database, null).migrate();
    database.jdbc().execute("alter table tasks drop column name");
    assertThatThrownBy(
            () -> {
              try (var ignored = startProduction(database)) {
                throw new AssertionError("Drifted schema must not start");
              }
            })
        .hasStackTraceContaining("missing column [name]");
    assertThat(
            database
                .jdbc()
                .queryForObject(
                    """
        select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'tasks' and column_name = 'name'
        """,
                    Integer.class))
        .isZero();
  }

  private static void assertCatalog(ConfigurableApplicationContext context, JdbcTemplate jdbc) {
    var entities = context.getBean(EntityManagerFactory.class).getMetamodel().getEntities();
    assertThat(entities).hasSize(12);
    int expectedIndexes = 0;
    for (var entity : entities) {
      Table table = entity.getJavaType().getAnnotation(Table.class);
      assertThat(TABLES).contains(table.name());
      for (var index : table.indexes()) {
        expectedIndexes++;
        String definition =
            jdbc.queryForObject(
                """
            select indexdef from pg_indexes
            where schemaname = 'public' and tablename = ? and indexname = ?
            """,
                String.class,
                table.name(),
                index.name().toLowerCase(Locale.ROOT));
        assertThat(definition.replace(" ", ""))
            .contains("(" + index.columnList().replace(" ", "") + ")");
      }
    }
    assertThat(expectedIndexes).isEqualTo(30);
    // Counts exclude Flyway's own history table; Hibernate validation alone does not cover these.
    for (var expected : Map.of("p", 12, "u", 6, "f", 25, "c", 15).entrySet()) {
      assertThat(
              jdbc.queryForObject(
                  """
          select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid
          join pg_namespace n on n.oid = t.relnamespace
          where n.nspname = 'public' and t.relname <> 'flyway_schema_history' and c.contype = ?::"char"
          """,
                  Integer.class,
                  expected.getKey()))
          .as("constraint type %s", expected.getKey())
          .isEqualTo(expected.getValue());
    }
    assertThat(
            jdbc.queryForList(
                """
        select table_name from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name <> 'flyway_schema_history'
        """,
                String.class))
        .containsExactlyInAnyOrderElementsOf(TABLES);
  }

  private static Database newDatabase() {
    assertThat(POSTGRES.isRunning()).isTrue();
    String name = "migration_" + UUID.randomUUID().toString().replace("-", "");
    new JdbcTemplate(dataSource(POSTGRES.getJdbcUrl())).execute("CREATE DATABASE " + name);
    String url =
        "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + name;
    return new Database(url, new JdbcTemplate(dataSource(url)));
  }

  private static DriverManagerDataSource dataSource(String url) {
    return new DriverManagerDataSource(url, POSTGRES.getUsername(), POSTGRES.getPassword());
  }

  private static Flyway flyway(Database database, String target) {
    var configuration =
        Flyway.configure()
            .dataSource(dataSource(database.url()))
            .locations("classpath:db/migration")
            .baselineOnMigrate(false)
            .cleanDisabled(true)
            .validateOnMigrate(true)
            .validateMigrationNaming(true);
    if (target != null) {
      configuration.target(target);
    }
    return configuration.load();
  }

  private static Flyway configured(Database database, String... locations) {
    return Flyway.configure()
        .dataSource(dataSource(database.url()))
        .locations(locations)
        .baselineOnMigrate(false)
        .cleanDisabled(true)
        .validateOnMigrate(true)
        .validateMigrationNaming(true)
        .load();
  }

  private static void seed(Database database) {
    new ResourceDatabasePopulator(new ClassPathResource("migration/upgrade-fixture.sql"))
        .execute(dataSource(database.url()));
  }

  private static Map<String, List<String>> snapshot(Database database) {
    Map<String, List<String>> rows = new LinkedHashMap<>();
    for (String table : TABLES) {
      rows.put(
          table,
          database
              .jdbc()
              .queryForList(
                  "select row_to_json(t)::text from " + table + " t order by id", String.class));
    }
    return rows;
  }

  private static void assertSqlState(Runnable operation, String expected) {
    assertThatThrownBy(operation::run)
        .rootCause()
        .isInstanceOfSatisfying(
            SQLException.class, cause -> assertThat(cause.getSQLState()).isEqualTo(expected));
  }

  private static ConfigurableApplicationContext startProduction(Database database) {
    SpringApplication application = new SpringApplication(TeamTaskManagerApplication.class);
    application.setRegisterShutdownHook(false);
    return application.run(
        "--spring.profiles.active=prod",
        "--server.port=0",
        "--spring.datasource.url=" + database.url(),
        "--spring.datasource.username=" + POSTGRES.getUsername(),
        "--spring.datasource.password=" + POSTGRES.getPassword(),
        "--auth.jwt.secret=migration-test-only-secret-at-least-thirty-two-bytes-long",
        "--auth.jwt.issuer=migration-tests",
        "--frontend.url=https://example.test",
        "--app.bootstrap-admin.email=",
        "--app.bootstrap-admin.password=",
        "--logging.level.root=WARN",
        "--spring.main.banner-mode=off");
  }

  private record Database(String url, JdbcTemplate jdbc) {}
}
