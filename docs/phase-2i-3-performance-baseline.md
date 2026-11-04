# Phase 2I, part 3: measured baseline and implementation options

**Historical pre-change assessment.** The user subsequently approved option 1; see [implemented changes and before/after verification](phase-2i-3-performance.md). Statements below about pending choices describe the measurement checkpoint.

Measured November 4, 2026 against user commit `b02e3b9` (`fix: search full activity history and resolve authorized destinations`). The user approved measurement first, using generated data in a disposable database, and choosing improvements before application changes. **Measurement is complete; runtime optimizations are not yet approved or implemented.** This is an intermediate checkpoint within 2I part 3, not completion of the phase.

## Main findings

1. **Mixed history and notification pages issue repeated per-item lookups.** A 20-row team page executes 66 prepared SQL statements, compared with 10 when all rows share one actor/task/project. A 50-row mixed page executes 127. The 20-row query itself retrieves its first rows quickly; entity/route mapping adds actor, task and project loads. The 12-notification page adds loads for actors, source activity, tasks and projects: 52 SQL statements in the mixed fixture, 20 even in the concentrated fixture.
2. **The inbox page scans far more rows than it returns.** The large fixture's current recipient-email join and ordering plan reads 100,000 matching notification rows to return twelve. Its measured page query execution is 39.25ms and its count 18.15ms in separate EXPLAIN samples. A stable recipient-ID lookup plus an order-preserving query/index plan is a candidate to test; no speedup is claimed before implementation and remeasurement.
3. **Contains search has a separate scanning cost.** At 100,200 scoped events, a rare-match request has a 351ms local median; a no-match request is 325ms despite only six SQL statements. The no-match plan traverses 100,200 events and performs repeated actor/task lookups while evaluating the cross-field predicate. A broad current-task-name search returns its page quickly, but its exact matching count takes 162.5ms in the separate plan sample. Reducing repeated mapping queries alone will not remove all search/count work.
4. **Every activity generates metric/KPI snapshots that the current application does not read.** One task comment generates seven metric rows and three KPI rows, in addition to its activity, audit and two eligible recipient notifications. All seven measured comment calls generated exactly 49 metric and 21 KPI rows. Current insights endpoints calculate live counts from task/project/member/activity repositories. Source inspection found snapshot repositories used only for saving; historical snapshot data has no current application read path.
5. **Cascade archive amplifies that work.** Archiving one project containing 21 tasks executes 619 SQL statements and creates 22 activities, 22 audits, 22 system events, 20 notifications and 220 metric/KPI snapshot rows. This archive is a single diagnostic sample (626ms), not a latency percentile or capacity estimate. The smaller six-task case executes 199 statements and creates 70 snapshot rows.

## Representative results

These are **sequential local warm-cache measurements**, including HTTP authentication, authorization, DTO mapping and serialization. The database runs in Docker on this computer. Timings include test-only tracing and are not deployment response-time guarantees.

| Workload                           | Prepared SQL executions/request | Local median | Notes                                               |
| ---------------------------------- | ------------------------------: | -----------: | --------------------------------------------------- |
| Team history, 20 mixed rows        |                              66 |      54.55ms | 83 entities loaded                                  |
| Team history, 20 concentrated rows |                              10 |      11.97ms | Shared actor/task/project                           |
| Project history, 20 mixed rows     |                              34 |      28.40ms | Main large fixture                                  |
| Task history, 20 rows              |                              19 |      15.90ms | One task, multiple actors                           |
| Inbox, 12 mixed records            |                              52 |      80.10ms | 61 entities loaded                                  |
| Unread inbox, 12 mixed records     |                              53 |      72.21ms | Same current recipient scope                        |
| Full unread count                  |                               3 |      15.69ms | Includes authentication                             |
| Rare activity search               |                              60 |     351.38ms | Full scoped filter and exact count                  |
| No-match activity search           |                               6 |     324.74ms | Low query count still does substantial work         |
| Broad task-name activity search    |                              67 |     214.33ms | Exact count is material                             |
| Task comment                       |                              36 |      37.16ms | Ten snapshot rows plus activity/audit/notifications |
| Task-name edit                     |                              38 |      38.24ms | Ten snapshot rows per event                         |
| Team-name edit                     |                              23 |      26.34ms | Six snapshot rows per event                         |
| Member-role change                 |                              27 |      28.63ms | Six snapshot rows per event                         |

Seven samples per ordinary operation had the same SQL counts. Small/medium/large mixed pages had the same repeated-query counts; page diversity, rather than only table size, exposes the mapping cost. Some small-fixture timings are higher because local JVM/database/cache/scheduling noise remains. Do not infer a scale curve from a single timing column.

For a large mixed team history page, the recorded shape is 22 user reads, one session-family read, one team read, one membership read, two activity reads (page/count), 19 project reads and 20 task reads. For a mixed notification page, it is 13 user reads, one session-family read, two notification reads, twelve source-activity reads, twelve task reads, eleven project reads and one team read.

## How measurement was performed

- PostgreSQL 17 Testcontainers under the existing `test` profile; no local `.env` or development datasource. Before any fixture writes or EXPLAIN, the harness asserts that its actual JDBC URL equals the running disposable container's JDBC URL. Bootstrap-admin initialization is disabled by the existing test configuration.
- Four independent workspace datasets, all seeded before read measurements and followed by `ANALYZE`: small (101 tasks / 1,200 activities / 1,000 notifications), medium (1,001 / 10,200 / 10,000), large (10,001 / 100,200 / 100,000), and concentrated (101 / 1,000 / 1,000). Each has 20 projects and 51 members. Concentrated rows deliberately reuse one actor/task/project; mixed fixtures distribute identities. An additional 200 older events provide a multi-actor task history in mixed fixtures. Record counts include the fixture's initial task.
- Real MockMvc HTTP endpoints and persisted session-family bearers exercise the actual authorization and service flow. The role-write fixture alternates roles; write warmups are excluded from per-seven-call growth totals. Separate small datasets supply one-shot cascade archives containing six and 21 tasks.
- Three warmups, then seven sequential samples per read/write case. End-to-end wall-clock timing, captured JDBC executions, Hibernate entity-load/insert/update statistics and before/after table counts are recorded. Schema creation, fixture insertion, separate EXPLAIN runs and before/after counting are outside measured requests. Connection protocol operations are not counted as prepared SQL executions.
- JDBC observation uses a test-only datasource wrapper, recording execution and bound setters. SELECT statements are replayed as `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` with the same bindings against the same container. Plan samples are additional executions, not the same samples used for endpoint medians. Only SELECTs are explained; write behavior is measured through actual disposable fixture operations.
- The relevant recorded plans have warm shared buffers and zero physical block reads. Timings do not model cold disks, deployment network distance, concurrent users, sustained throughput, lock contention under load, or a production SLA. Those remain release/load work in 2K.

The instrumentation uses Hibernate's [statistics API](https://docs.hibernate.org/orm/7.1/javadocs/org/hibernate/stat/Statistics.html). PostgreSQL's [EXPLAIN guidance](https://www.postgresql.org/docs/17/using-explain.html) describes plan nodes, actual loops and execution measurements; estimated planner cost is not reported here as elapsed time.

## Evidence and reproduction

- [Recorded summary](performance/phase-2i-3-baseline.json): all workload samples, SQL shapes, table-growth totals, fixture sizes and compact query-plan evidence. This is generated diagnostic data, not a new application contract.
- `backend/src/test/java/com/example/task_manager/profiling/ActivityNotificationProfileTest.java`: opt-in fixtures, endpoint cases, measurements, SQL-plan capture and report writing. Change fixture sizes/sample counts here to test another scenario. Timings have no pass/fail threshold.
- `backend/src/test/java/com/example/task_manager/profiling/ProfileJdbcTrace.java`: test-only JDBC execution/binding observation. It is imported only by the opt-in profiling test.
- Full raw SQL/plan report from this run: `backend/target/profiling/activity-notifications-baseline.json` (generated/ignored build output). The summary retains the useful evidence if `target` is cleaned. Re-running regenerates synthetic IDs and timing samples.

From `backend`, with Docker available and `JAVA_HOME` pointing to the configured JDK:

```powershell
.\mvnw.cmd -B -ntp -Dttm.profile=true -Dtest=ActivityNotificationProfileTest test
```

The diagnostic is disabled unless `ttm.profile=true` is explicitly supplied, so ordinary verification does not perform this dataset seeding or profiling. The opt-in run passed: one diagnostic test, zero failures/errors/skips. A separate ordinary run confirmed that the diagnostic is skipped by default (one intentional skip) without starting the profiling workload. Spotless/Prettier checks pass. Existing 305 backend and 272 frontend application tests are prior verification; they are not claimed as rerun by this measurement. No application runtime file, dependency, lockfile, schema, permission, delivery semantics or development data changed. No staging, commit or push was performed.

## Choices before implementation

All options preserve current authorization, full-history search semantics, accurate totals, and transactional activity/audit/notification behavior. Implementation requires the user's choice and regression verification.

1. **Recommended: optimize reads and stop unused per-event snapshot writes.** Test bounded related-data fetching/projections, stable recipient-ID inbox queries and improved exact search/count plans. Stop automatically appending metric/KPI rows on every activity; retain existing rows and live insights. This removes current unused write amplification without introducing a scheduler/worker. Tradeoff: new per-event snapshot history will no longer accumulate; a future historical analytics feature would need its own sampling/retention design.
2. **Optimize reads and preserve per-event snapshot history.** Keep creating snapshots for every activity, but consolidate repeated aggregate queries where measurements support it. Tradeoff: snapshot row growth remains; comment/archive operations still produce those historical rows even though the current UI does not consume them.
3. **Optimize reads first, leave saves unchanged.** Address related-data lookups, recipient query plans and search/count cost, retaining the current snapshot pipeline for a later decision. Tradeoff: the measured write/row amplification remains in place for now.

Read-query alternatives must be benchmarked and preserve the just-verified filters/visibility; an index or count rewrite is not assumed to be correct or faster in advance. Any new index deployment remains explicit and versioned, with no manual development-database changes. Search indexing can be a separate reviewable batch if its tradeoffs warrant it.

Notification creation currently participates in the business transaction. Decoupling it would require an approved durable-delivery/retry design and different failure/visibility guarantees. The measured repeated reads and unused metric writes provide concrete work to address first; no broker, outbox or asynchronous delivery was added during this assessment.

Phase 2I part 3 remains in progress awaiting the implementation choice. The roadmap still has approximately seven unfinished parts overall; measurement alone does not mark this phase production-ready.
