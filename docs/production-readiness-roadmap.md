# Production readiness roadmap

Planning estimate as of 2026-11-03. This covers the remaining v1 hardening and UI/structure work identified in the module-flow review. Each phase needs its own approval before implementation; items below are proposed scope, not authorization to begin them.

There are **six phases in this remaining plan, including Phase 2F**, with **about three parts per phase** (18 parts). Phase 2F is now implemented; after it is reviewed/committed, **five phases and approximately 15 parts remain**. Parts are reviewable work packages, not a requirement to create a branch or commit for every part. The user makes all commits.

| Phase                          | Status                                   | Part 1                                                          | Part 2                                                                   | Part 3                                                                  |
| ------------------------------ | ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 2F: team-member changes        | Implemented; awaiting user review/commit | Independently committed member changes                          | Partial-result feedback, retry selections and cache refresh              | Failure-injection, concurrency and UI regression verification           |
| 2G: task-flow consistency      | Proposed                                 | Assignment/support flows and complete member selection          | Priority/status/API/type agreement                                       | Board filtering, movement and workflow behavior                         |
| 2H: reliable data and editing  | Proposed                                 | Shared query keys, cache updates and optimistic behavior        | Consistent user editing and directory/privacy policy                     | Cross-tab session coordination and remaining loading/error/retry states |
| 2I: notifications and activity | Proposed                                 | Inbox pagination, unread filtering and matching totals          | History search/grouping, navigation and inaccessible destinations        | Measure write-path cost and agree on delivery/performance changes       |
| 2J: structure and UI/UX        | Proposed                                 | Focused module boundaries and shared task-screen logic          | Consistent modern shared/shadcn components and visual patterns           | Responsive/accessibility checks and module-by-module usability review   |
| 2K: release readiness          | Proposed                                 | Versioned database migrations, constraints and index deployment | Environment/deployment configuration, monitoring and recovery procedures | End-to-end, security and load checks; release checklist                 |

Earlier checkpoints completed: Phase 1 (workflow/security/name contracts), 2A (compatible dependency upgrades and formatting), 2B (former-member access), 2C (permission agreement and super-admin recovery), 2D (archiving), and 2E (session revocation).

This is an estimate, not a fixed release date or a guarantee that verification will reveal no additional work. A phase can be split if a newly confirmed issue warrants it, with scope explained and approved first. The intention is to finish correctness and reliable module flows before broad visual/structural changes.

Restoration remains deferred under the Phase 2D decision. Additional Jira-style features such as sprints, backlogs, custom workflows, reporting, or integrations would be separately scoped rather than silently included in these counts.

Current implementation details: [Phase 2F membership batches](phase-2f-membership-batches.md).
