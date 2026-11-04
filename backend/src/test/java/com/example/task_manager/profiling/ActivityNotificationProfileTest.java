package com.example.task_manager.profiling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.example.task_manager.auth.RefreshTokenService;
import com.example.task_manager.config.jwt.JwtService;
import com.example.task_manager.support.PostgresIntegrationTest;
import com.example.task_manager.support.TestFixtures;
import com.example.task_manager.support.TestFixtures.Workspace;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

/** Opt-in diagnostic, not an SLA test. No runtime configuration or production data is used. */
@EnabledIfSystemProperty(named = "ttm.profile", matches = "true")
@TestPropertySource(
    properties = {
      "spring.jpa.properties.hibernate.generate_statistics=true",
      "spring.jpa.properties.hibernate.session.events.log=false",
      "logging.level.org.hibernate.stat=OFF"
    })
@Import(ActivityNotificationProfileTest.TraceConfiguration.class)
class ActivityNotificationProfileTest extends PostgresIntegrationTest {
  @Autowired WebApplicationContext context;
  @Autowired TransactionTemplate transactions;
  @Autowired EntityManager em;
  @Autowired EntityManagerFactory emf;
  @Autowired JdbcTemplate jdbc;
  @Autowired DataSource dataSource;
  @Autowired PostgreSQLContainer postgres;
  @Autowired JwtService jwt;
  @Autowired RefreshTokenService sessions;
  private final JsonMapper json = JsonMapper.builder().build();
  private MockMvc mvc;
  private Statistics stats;
  private final List<Map<String, Object>> results = new ArrayList<>();
  private final List<Map<String, Object>> plans = new ArrayList<>();
  private final List<Map<String, Object>> datasets = new ArrayList<>();
  private int sequence;
  private static final Pattern TABLE =
      Pattern.compile("(?i)(?:from|join|into|update)\\s+([a-z_]+)");
  private static final List<String> GROWTH =
      List.of(
          "activity_events",
          "audit_logs",
          "metric_snapshots",
          "kpi_snapshots",
          "notifications",
          "system_events");
  private static final Instant NOW = Instant.parse("2026-11-04T00:00:00Z");

  @TestConfiguration(proxyBeanMethods = false)
  static class TraceConfiguration {
    @Bean
    static BeanPostProcessor profileDataSource() {
      return new BeanPostProcessor() {
        @Override
        public Object postProcessAfterInitialization(Object bean, String name) {
          return bean instanceof DataSource source
                  && !(bean instanceof ProfileJdbcTrace.TracedDataSource)
              ? new ProfileJdbcTrace.TracedDataSource(source)
              : bean;
        }
      };
    }
  }

  record Data(
      String label,
      Workspace space,
      String bearer,
      List<UUID> actors,
      List<UUID> projects,
      List<UUID> tasks,
      int events,
      int notifications) {}

  @FunctionalInterface
  interface Request {
    MockHttpServletRequestBuilder build();
  }

  @Test
  void profileIsolatedWorkloads() throws Exception {
    // Refuse to seed or EXPLAIN unless this connection is the disposable service-connected
    // container.
    try (var connection = dataSource.getConnection()) {
      assertThat(connection.getMetaData().getURL()).isEqualTo(postgres.getJdbcUrl());
    }
    assertThat(postgres.isRunning()).isTrue();
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    stats = emf.unwrap(SessionFactory.class).getStatistics();
    assertThat(stats.isStatisticsEnabled()).isTrue();
    var small = seed("small", 100, 1000, false);
    var medium = seed("medium", 1000, 10000, false);
    var large = seed("large", 10000, 100000, false);
    var concentrated = seed("concentrated", 100, 1000, true);
    jdbc.execute("ANALYZE");
    for (Data data : List.of(small, medium, large, concentrated)) {
      String team = "/api/teams/" + data.space().team().getKey();
      for (int size : new int[] {1, 20, 50})
        read(
            data,
            "team_history_" + size,
            () -> get(team + "/activities").param("size", String.valueOf(size)),
            data.events(),
            size == 20);
      read(
          data,
          "project_history_20",
          () ->
              get(team + "/projects/" + data.space().project().getKey() + "/activities")
                  .param("size", "20"),
          -1,
          false);
      read(
          data,
          "task_history_20",
          () -> get(data.space().taskPath() + "/activities").param("size", "20"),
          -1,
          false);
      read(
          data,
          "inbox_12",
          () -> get("/api/notifications").param("size", "12"),
          data.notifications(),
          true);
      read(
          data,
          "unread_inbox_12",
          () -> get("/api/notifications").param("size", "12").param("unreadOnly", "true"),
          -1,
          false);
      read(data, "unread_count", () -> get("/api/notifications/unread-count"), -1, false);
    }
    for (String search : List.of("rare-search-needle", "not-present-anywhere", "Profile task")) {
      read(
          large,
          "team_search_" + search.replace(' ', '_'),
          () ->
              get("/api/teams/" + large.space().team().getKey() + "/activities")
                  .param("size", "20")
                  .param("search", search),
          -1,
          true);
    }
    for (Data data : List.of(small, large)) {
      jdbc.update(
          "UPDATE tasks SET assignee_id=?,support_id=? WHERE id=?",
          data.actors().get(0),
          data.actors().get(1),
          data.space().task().getId());
      measure(
          data,
          "comment_write",
          () ->
              post(data.space().taskPath() + "/activities")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"message\":\"Profile comment " + (++sequence) + "\"}"),
          true,
          false,
          -1);
      measure(
          data,
          "task_name_write",
          () ->
              patch(data.space().taskPath())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"name\":\"Profile task edit " + (++sequence) + "\"}"),
          true,
          false,
          -1);
      measure(
          data,
          "team_name_write",
          () ->
              patch("/api/teams/" + data.space().team().getKey())
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"name\":\"Profile team edit " + (++sequence) + "\"}"),
          true,
          false,
          -1);
      String role =
          "/api/teams/"
              + data.space().team().getKey()
              + "/members/"
              + data.actors().get(3)
              + "/role";
      measure(
          data,
          "member_role_write",
          () ->
              patch(role)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"role\":\"" + ((++sequence) % 2 == 0 ? "ADMIN" : "MEMBER") + "\"}"),
          true,
          false,
          -1);
    }
    for (int size : new int[] {5, 20}) {
      Data archive = seed("archive_" + size, size, 30, true);
      // Put every generated task in the project's archive scope (including its fixture task).
      jdbc.update(
          "UPDATE tasks SET project_id=?,task_number=task_number+10000 WHERE project_id IN (SELECT id FROM projects WHERE team_id=?) AND id<>?",
          archive.space().project().getId(),
          archive.space().team().getId(),
          archive.space().task().getId());
      measureOnce(
          archive,
          "archive_project_" + (size + 1),
          () ->
              delete(
                  "/api/teams/"
                      + archive.space().team().getKey()
                      + "/projects/"
                      + archive.space().project().getKey()));
    }
    var report = new LinkedHashMap<String, Object>();
    report.put("baselineReference", "b02e3b9");
    String label = System.getProperty("ttm.profile.label", "current");
    if (!label.matches("[A-Za-z0-9_-]{1,40}"))
      throw new IllegalArgumentException("Invalid profiling label");
    report.put("runLabel", label);
    report.put("database", jdbc.queryForObject("select version()", String.class));
    report.put("java", System.getProperty("java.version"));
    report.put("samplesPerReadWrite", 7);
    report.put("warmups", 3);
    report.put("datasets", datasets);
    report.put("results", results);
    report.put("plans", plans);
    report.put(
        "note",
        "Sequential local warm-cache diagnostic with test-only JDBC tracing and Hibernate statistics; not a production SLA or concurrent load benchmark. Archive operations are single samples.");
    Path output = Path.of("target", "profiling", "activity-notifications-" + label + ".json");
    Files.createDirectories(output.getParent());
    Files.writeString(output, json.writerWithDefaultPrettyPrinter().writeValueAsString(report));
    System.out.println("PROFILE_REPORT=" + output.toAbsolutePath());
  }

  private void read(Data data, String name, Request request, int total, boolean explain)
      throws Exception {
    measure(data, name, request, false, explain, total);
  }

  private void measure(
      Data data, String name, Request request, boolean write, boolean explain, int total)
      throws Exception {
    for (int i = 0; i < 3; i++) perform(data, request, total);
    var elapsed = new ArrayList<Double>();
    var counts = new ArrayList<Integer>();
    var loads = new ArrayList<Long>();
    var inserts = new ArrayList<Long>();
    var updates = new ArrayList<Long>();
    List<ProfileJdbcTrace.Sample> representative = List.of();
    Map<String, Long> before = write ? growth() : Map.of();
    for (int i = 0; i < 7; i++) {
      stats.clear();
      var trace = new ArrayList<ProfileJdbcTrace.Sample>();
      ProfileJdbcTrace.CURRENT.set(trace);
      long start = System.nanoTime();
      try {
        perform(data, request, total);
      } finally {
        elapsed.add((System.nanoTime() - start) / 1_000_000.0);
        ProfileJdbcTrace.CURRENT.remove();
      }
      counts.add(trace.size());
      loads.add(stats.getEntityLoadCount());
      inserts.add(stats.getEntityInsertCount());
      updates.add(stats.getEntityUpdateCount());
      representative = trace;
    }
    var result = new LinkedHashMap<String, Object>();
    result.put("dataset", data.label());
    result.put("operation", name);
    result.put("sqlCounts", counts);
    result.put("medianMs", median(elapsed));
    result.put("minMs", elapsed.stream().mapToDouble(Double::doubleValue).min().orElseThrow());
    result.put("maxMs", elapsed.stream().mapToDouble(Double::doubleValue).max().orElseThrow());
    result.put("entityLoads", loads);
    result.put("entityInserts", inserts);
    result.put("entityUpdates", updates);
    result.put("sqlShape", shape(representative));
    if (write) {
      var after = growth();
      var delta = new LinkedHashMap<String, Long>();
      for (String table : GROWTH) delta.put(table, after.get(table) - before.get(table));
      result.put("rowsAddedAcrossSevenCalls", delta);
    }
    results.add(result);
    if (explain) explain(data, name, representative);
  }

  private void measureOnce(Data data, String name, Request request) throws Exception {
    var before = growth();
    stats.clear();
    var trace = new ArrayList<ProfileJdbcTrace.Sample>();
    ProfileJdbcTrace.CURRENT.set(trace);
    long start = System.nanoTime();
    try {
      perform(data, request, -1);
    } finally {
      ProfileJdbcTrace.CURRENT.remove();
    }
    var result = new LinkedHashMap<String, Object>();
    result.put("dataset", data.label());
    result.put("operation", name);
    result.put("singleSampleMs", (System.nanoTime() - start) / 1_000_000.0);
    result.put("sqlCount", trace.size());
    result.put("entityInserts", stats.getEntityInsertCount());
    result.put("sqlShape", shape(trace));
    var after = growth();
    var delta = new LinkedHashMap<String, Long>();
    for (String table : GROWTH) delta.put(table, after.get(table) - before.get(table));
    result.put("rowsAdded", delta);
    results.add(result);
  }

  private void perform(Data data, Request request, int total) throws Exception {
    var response =
        mvc.perform(request.build().header("Authorization", data.bearer()))
            .andReturn()
            .getResponse();
    assertThat(response.getStatus())
        .withFailMessage(
            "Unexpected status %s: %s", response.getStatus(), response.getContentAsString())
        .isBetween(200, 299);
    if (total >= 0)
      assertThat(json.readTree(response.getContentAsString()).get("totalElements").asInt())
          .isEqualTo(total);
  }

  private Map<String, Long> growth() {
    var result = new LinkedHashMap<String, Long>();
    for (String table : GROWTH)
      result.put(table, jdbc.queryForObject("select count(*) from " + table, Long.class));
    return result;
  }

  private static double median(List<Double> values) {
    return values.stream().sorted().toList().get(values.size() / 2);
  }

  private Map<String, Object> shape(List<ProfileJdbcTrace.Sample> trace) {
    var groups = new LinkedHashMap<String, Integer>();
    double sqlMs = 0;
    for (var sample : trace) {
      String verb = sample.sql().stripLeading().split(" ", 2)[0].toUpperCase();
      var matcher = TABLE.matcher(sample.sql());
      String table = matcher.find() ? matcher.group(1) : "other";
      groups.merge(verb + " " + table, 1, Integer::sum);
      sqlMs += sample.nanos() / 1_000_000.0;
    }
    return Map.of("statementsByFirstTable", groups, "lastSampleJdbcExecuteMs", sqlMs);
  }

  private void explain(Data data, String operation, List<ProfileJdbcTrace.Sample> trace)
      throws Exception {
    int index = 0;
    for (var sample : trace) {
      String sql = sample.sql().stripLeading().toLowerCase();
      if (!sql.startsWith("select")
          || (!sql.contains("from activity_events") && !sql.contains("from notifications")))
        continue;
      try (var connection = dataSource.getConnection();
          var statement =
              connection.prepareStatement(
                  "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + sample.sql())) {
        sample.bind(statement);
        try (var rows = statement.executeQuery()) {
          rows.next();
          plans.add(
              Map.of(
                  "dataset",
                  data.label(),
                  "operation",
                  operation,
                  "query",
                  ++index,
                  "sql",
                  sample.sql(),
                  "plan",
                  json.readTree(rows.getString(1))));
        }
      }
    }
  }

  private Data seed(String label, int tasksCount, int eventsCount, boolean concentrated) {
    Workspace space = transactions.execute(status -> TestFixtures.workspace(em));
    var actors = new ArrayList<UUID>();
    var projects = new ArrayList<UUID>();
    projects.add(space.project().getId());
    var tasks = new ArrayList<UUID>();
    tasks.add(space.task().getId());
    Timestamp date = Timestamp.from(NOW);
    for (int i = 0; i < 50; i++) {
      UUID id = UUID.randomUUID();
      actors.add(id);
      jdbc.update(
          "INSERT INTO users (id,first_name,last_name,email,password,role,created_at,updated_at,version) VALUES (?,?,'Actor',?,'test-only-not-used','USER',?,?,0)",
          id,
          "Profile " + i,
          id + "@example.test",
          date,
          date);
      jdbc.update(
          "INSERT INTO team_members (id,team_id,user_id,added_by,role,joined_at,version) VALUES (?,?,?,?,'MEMBER',?,0)",
          UUID.randomUUID(),
          space.team().getId(),
          id,
          space.owner().getId(),
          date);
    }
    for (int i = 1; i < 20; i++) {
      UUID id = UUID.randomUUID();
      projects.add(id);
      jdbc.update(
          "INSERT INTO projects (id,project_key,name,status,team_id,owner_id,created_by,next_task_number,created_at,updated_at,version) VALUES (?,?,?,'ACTIVE',?,?,?,1000000,?,?,0)",
          id,
          "PROFILE-" + id,
          "Profile project " + i,
          space.team().getId(),
          space.owner().getId(),
          space.owner().getId(),
          date,
          date);
    }
    var batch = new ArrayList<Object[]>();
    for (int i = 0; i < tasksCount; i++) {
      UUID id = UUID.randomUUID();
      tasks.add(id);
      String status =
          i % 10 < 2 ? "DONE" : i % 10 == 2 ? "CANCELLED" : i % 10 < 5 ? "IN_PROGRESS" : "TODO";
      batch.add(
          new Object[] {
            id,
            projects.get(i % 20),
            (long) (i + 2),
            "Profile task " + i,
            status,
            "MEDIUM",
            space.owner().getId(),
            actors.get(i % 50),
            space.owner().getId(),
            date,
            date,
            Timestamp.from(NOW.minusSeconds(3600)),
            Timestamp.from(NOW.minusSeconds(7200)),
            status.equals("DONE") ? date : null
          });
    }
    jdbc.batchUpdate(
        "INSERT INTO tasks (id,project_id,task_number,name,status,priority,assignee_id,support_id,created_by,created_at,updated_at,planned_due_date,actual_start_date,actual_completion_date,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)",
        batch);
    String taskFilter = concentrated ? "AND id='" + space.task().getId() + "'" : "";
    String sql =
        "WITH choices AS (SELECT id,project_id,row_number() over(order by task_number,id)-1 as rn FROM tasks WHERE project_id IN(SELECT id FROM projects WHERE team_id=?) "
            + taskFilter
            + "), actors AS (SELECT user_id,row_number() over(order by user_id)-1 as rn FROM team_members WHERE team_id=? AND user_id<>?) INSERT INTO activity_events (id,team_id,project_id,task_id,entity_type,entity_id,event_type,details_json,message,user_id,created_at) SELECT gen_random_uuid(),?,t.project_id,t.id,'TASK',t.id,'TASK_COMMENTED',jsonb_build_object('task',jsonb_build_object('id',t.id,'label','Profile historical task'),'project',jsonb_build_object('id',t.project_id,'label','Profile historical project')),CASE WHEN s.i%997=996 THEN 'rare-search-needle' ELSE 'Profile event '||s.i END,a.user_id,?::timestamptz-make_interval(secs=>s.i) FROM generate_series(0,?)s(i) JOIN choices t ON t.rn=s.i%? JOIN actors a ON a.rn="
            + (concentrated ? "0" : "s.i%50");
    jdbc.update(
        sql,
        space.team().getId(),
        space.team().getId(),
        space.owner().getId(),
        space.team().getId(),
        date,
        eventsCount - 1,
        concentrated ? 1 : tasksCount + 1);
    if (!concentrated)
      jdbc.update(
          "INSERT INTO activity_events (id,team_id,project_id,task_id,entity_type,entity_id,event_type,details_json,message,user_id,created_at) SELECT gen_random_uuid(),?,?,?,'TASK',?,'TASK_COMMENTED','{}'::jsonb,'Task history sample '||s.i,a.user_id,?::timestamptz-interval '3 days'-make_interval(secs=>s.i) FROM generate_series(0,199)s(i) JOIN (SELECT user_id,row_number() over(order by user_id)-1 rn FROM team_members WHERE team_id=? AND user_id<>?)a ON a.rn=s.i%50",
          space.team().getId(),
          space.project().getId(),
          space.task().getId(),
          space.task().getId(),
          date,
          space.team().getId(),
          space.owner().getId());
    int allEvents = eventsCount + (concentrated ? 0 : 200);
    jdbc.update(
        "INSERT INTO notifications (id,recipient_id,actor_id,activity_event_id,type,title,body,target_path,team_id,project_id,task_id,created_at,read_at) SELECT gen_random_uuid(),?,e.user_id,e.id,'TASK','Profile notification','Test-only historical notice','/teams',e.team_id,e.project_id,e.task_id,e.created_at,CASE WHEN row_number()over(order by e.created_at)%4=0 THEN e.created_at ELSE NULL END FROM activity_events e WHERE e.team_id=? ORDER BY e.created_at DESC LIMIT ?",
        space.owner().getId(), space.team().getId(), eventsCount);
    String bearer = TestFixtures.authorization(jwt, sessions, space.owner());
    Data data = new Data(label, space, bearer, actors, projects, tasks, allEvents, eventsCount);
    datasets.add(
        Map.of(
            "label",
            label,
            "tasks",
            tasksCount + 1,
            "projects",
            20,
            "members",
            51,
            "activityEvents",
            allEvents,
            "notifications",
            eventsCount,
            "concentrated",
            concentrated));
    return data;
  }
}
