# Phase 2I, part 3: bounded reads and efficient event writes

Implemented November 4, 2026 against user commit `b02e3b9`. After the [measured baseline](phase-2i-3-performance-baseline.md), the user approved option 1: optimize reads and stop unused per-event metric/KPI writes while preserving live insights, stored snapshots, permissions and transactional activity/audit/notification behavior. Changes are verified and remain for the user's review/commit.

## What changed

### Related data is loaded per page

Activity pages now use a Spring Data entity graph for the actor and task/project/team references actually used by the response. All graph paths are **to-one associations**. There is no collection fetch that would duplicate activity rows or move pagination into Java. The count query remains an exact scoped database count. Team-history project-only references are fetched once for the page, alongside task-linked references already loaded by the graph.

Notification inbox pages similarly fetch actors, source activity and task/project/team references together. Remaining project-only/team-only routes are resolved in page-scoped batches. Response mapping no longer loads each item's related records separately. Legacy stored paths, current public keys/numbers, membership routes and unavailable-destination behavior retain their existing contracts.

The inbox and unread-count queries now use the authenticated recipient's **database ID** after a fresh case-insensitive user lookup. This avoids the recipient-email join in the page's ordering plan and uses the existing recipient indexes. The public API still derives the viewer from authentication; no client-supplied recipient ID or expanded access is introduced. IDs remain internal associations, while public project/team keys and task numbers remain routing identifiers. The existing owned-notification read/destination checks are unchanged.

Read all reuses its already resolved recipient ID for its returned unread count. It still updates the entire current recipient inbox and returns the real remaining count, including concurrent arrivals where visible under the existing transaction semantics.

### Search matches related identities once

The full-history search predicate now uses uncorrelated matching-user/task/project ID subqueries. It then tests event identity fields against those results, instead of repeatedly evaluating related actor/task rows for every event. Event message, stored reference labels, current names, actor identity/email, project key, task number and displayed/raw event type matching are preserved. Search still trims, case-folds and escapes literal wildcard characters, runs inside the already authorized scope, precedes paging/counting, and retains exact totals and deterministic chronology.

No new search index, extension, schema migration or background indexing job was added. The change removes redundant related-row work; arbitrary substring/JSON-label matching still has scanning cost at larger histories.

### Activity no longer generates unused metric snapshots

`ObservabilityService.recordFromActivity` still writes the audit record and high-signal system event in the same business transaction. Activity and eligible notifications are still recorded transactionally by the existing activity service. It no longer recalculates metrics and inserts metric/KPI snapshots for every event.

The current insight endpoints already query live domain data and continue doing so. Existing snapshot tables/entities/repositories and rows remain intact. No stored snapshot was deleted or rewritten. The behavior intentionally changed is **new per-event snapshot accumulation**; future historical analytics would need an explicitly designed sampling/retention policy. This does not remove activity history, audit history, task data or current insights, and does not introduce eventual notification delivery.

## Before/after evidence

Same generated workload definitions, three warmups and seven sequential samples per ordinary case; separate one-shot archive fixtures. SQL counts are consistent across the seven samples. Timings are local warm-cache diagnostics with test instrumentation, not deployment guarantees.

| Large-fixture workload        | SQL before → after | Local milliseconds before → after |
| ----------------------------- | -----------------: | --------------------------------: |
| Team history, 20 mixed rows   |             66 → 7 |                     54.55 → 24.99 |
| Team history, 50 mixed rows   |            127 → 7 |                     90.29 → 27.61 |
| Project history, 20 rows      |             34 → 8 |                     28.40 → 17.30 |
| Task history, 20 rows         |             19 → 9 |                     15.90 → 12.11 |
| Inbox, 12 mixed items         |             52 → 5 |                     80.10 → 20.09 |
| Unread inbox, 12 items        |             53 → 5 |                     72.21 → 22.12 |
| Rare-match history search     |             60 → 7 |                    351.38 → 89.64 |
| No-match history search       |              6 → 6 |                   324.74 → 116.17 |
| Broad task-name search        |             67 → 7 |                    214.33 → 53.21 |
| Comment save                  |            36 → 15 |                     37.16 → 15.70 |
| Task-name edit                |            38 → 17 |                     38.24 → 18.90 |
| Team-name edit                |            23 → 10 |                     26.34 → 12.23 |
| Member-role edit              |            27 → 14 |                     28.63 → 15.19 |
| Archive project with 21 tasks |          619 → 157 |  625.54 → 157.89 (single samples) |

The large fixture contains 10,001 tasks, 100,200 events and 100,000 notifications. Every measured comment now produces zero new metric/KPI rows while retaining one activity, one audit and two eligible recipient notifications. The 21-task archive creates zero snapshot rows, compared with 220 before; its activity/audit/system-event/notification counts remain 22/22/22/20.

The inbox's separate page-plan sample falls from 39.25ms to 0.68ms using the current entity-defined indexes. Its exact count still traverses the owned result set (11.99ms in that plan sample). The no-match search remains a scan, but avoids the former per-event related-row probes.

Not every metric is a decrease: the unread-count endpoint now makes four statements instead of three because it explicitly resolves a recipient ID; local median is 15.69ms → 15.02ms. A one-row team page is 22.87ms → 23.10ms in these samples. The purpose is bounded page work and removal of measured amplification, not a claim that every individual request is faster. Deployment network, cold caches, concurrency and indexes may differ.

Machine-readable evidence: [original baseline](performance/phase-2i-3-baseline.json), [optimized run](performance/phase-2i-3-optimized.json), and [comparison across all scenarios](performance/phase-2i-3-comparison.json). The original baseline is retained rather than overwritten. Full SQL/plans remain reproducible in generated `backend/target/profiling/` output.

## Files and customization

Paths below are under `backend/src/main/java/com/example/task_manager/` unless otherwise noted.

| Files                                                                                               | What they control                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `activity/ActivityEventRepository.java`                                                             | Page-only to-one fetch graph for specification queries. Keep collection relationships out of this graph; verify query counts, totals and paging when extending it.                                                                   |
| `activity/ActivityEventService.java`, `team/TeamService.java`, `project/ProjectRepository.java`     | Page-scoped project references, reusing loaded task context and batching missing projects with their team route data. Historical labels and authorized links keep their existing policy.                                             |
| `activity/ActivityHistoryQuery.java`                                                                | Matching identity subqueries, preserved text/type/snapshot filters, escaping, bounds and sorting. Add a matching-scope/count regression when extending search fields.                                                                |
| `notification/NotificationRepository.java`                                                          | Recipient-ID page/count predicates and bounded to-one notification graph. The owned single-notification operation keeps its ownership check.                                                                                         |
| `notification/NotificationService.java`                                                             | Fresh recipient resolution, batched legacy/current route mapping and read-all count reuse. It does not cache permissions or recipients across requests.                                                                              |
| `observability/ObservabilityService.java`                                                           | Audit/system-event persistence without per-event snapshot calculations/writes. Live insights methods remain intact. Snapshot model/repository classes are retained for existing data.                                                |
| `backend/src/test/java/.../profiling/ReadEfficiencyIntegrationTest.java`                            | Normal-CI structural query budgets, diverse task/project/team references, live insights, existing snapshot retention and rollback after injected notification failure. Query budgets test bounded round trips, not wall-clock speed. |
| `backend/src/test/java/.../profiling/ActivityNotificationProfileTest.java`, `ProfileJdbcTrace.java` | Explicit opt-in profiling fixtures, JDBC traces, entity statistics and SQL plans. `ttm.profile.label` selects a safe output label so baseline and later runs are separate.                                                           |
| Notification service/inbox tests                                                                    | Adapt repository tests to the unchanged public case-insensitive recipient-email contract and preloaded/batched mappings.                                                                                                             |
| `docs/performance/phase-2i-3-*.json`                                                                | Retained measurements and comparisons; generated evidence, not application API contracts.                                                                                                                                            |

The to-one fetch approach uses Spring Data's [entity graphs](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html#jpa.entity-graph) and preserves the existing [specification](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html) filtering/count model. No global eager-fetch setting, permission cache, new application dependency or database schema change is introduced.

## Verification and reproduction

- Maven verification passes: **312 application tests pass**, zero failures/errors. One additional opt-in diagnostic is intentionally skipped by default (313 discovered, one skipped). All previous ownership, former-member, privacy, archive, session, atomic-edit and membership rollback checks pass.
- Seven new normal-CI regression cases verify page work stays bounded as page size/related identities increase, project/team-only routes are batched, old metric/KPI values survive, live insights track a task reaching Done, comments/role edits/cascade archives add no snapshots, and an injected notification failure still rolls back the business edit/activity/audit together.
- The explicit optimized profiling run passes separately: one diagnostic, zero failures/errors/skips. It uses the same disposable PostgreSQL 17 isolation guard, synthetic workload and measurement method as the baseline.
- **272 frontend tests in 36 files pass**, strict lint has zero warnings, TypeScript/production build, Spotless, Prettier and both Docker builds pass. There is no frontend runtime change; the existing large JavaScript chunk warning remains for later structure/performance work.
- Test/profiling databases are disposable containers and the harness checks its actual JDBC URL before seeding or explaining SQL. Entity-defined schema/indexes are generated in that container. Development/production data and database configuration were not manually edited. Live deployment index installation is not certified by these tests.
- No stage, commit or push was performed.

Reproduce from `backend` with Docker and the configured JDK:

```powershell
.\mvnw.cmd -B -ntp "-Dttm.profile=true" "-Dttm.profile.label=optimized" "-Dtest=ActivityNotificationProfileTest" test
```

The full report is `target/profiling/activity-notifications-optimized.json`. Without a label, a diagnostic run writes `activity-notifications-current.json`; labels contain only letters, numbers, underscore or hyphen. Without `ttm.profile=true`, no profiling dataset/workload runs. Re-running on a different machine regenerates fixture IDs, plans and timings; evaluate correctness, statement scaling and timing distributions together.

## Review checkpoint

Suggested user commit message: `perf: bound activity and inbox reads and remove unused snapshot writes`.

Phase 2I's three parts are implemented. Two proposed phases remain, approximately three parts each: **2J structure/UI/UX and 2K release readiness (six parts)**. Next proposed checkpoint is 2J part 1: focused module boundaries and shared task-screen logic, with approval before implementation. Contains-search scaling, deployed indexes, concurrent load, monitoring and release verification remain work to assess in the later phases; local measurements are not a production-readiness certification.
