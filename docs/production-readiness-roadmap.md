# Production readiness roadmap

Updated November 5, 2026 against user commit `187d103`; checkpoint 6 database migrations are verified and uncommitted.

The objective remains to strengthen the existing v1, improve its structure/UI flows, and verify a production release before separately scoping more Jira-style capabilities. Implementation stays checkpoint-based, with scope/policy choices approved first and every commit made by the user.

## Current position

| Area               | Status                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phases 1–2I        | Completed: foundation/security/contracts, dependencies/formatting, membership/permissions, archives/sessions, task flows, cache/session consistency, notifications/activity and measured performance fixes |
| Phase 2J parts 1–2 | Completed: shared task views/module boundaries and consistent creation forms                                                                                                                               |
| Phase 2J part 3    | Verified complete: original UI findings and approved close-out corrections reconciled; checkpoint 5 is user-committed as `187d103`                                                                         |
| Phase 2K           | Checkpoint 6 database path verified; deployment/operations and final release acceptance remain                                                                                                             |

The previous “four unfinished parts” estimate counted one broad UI-review part plus three release packages. It obscured the work still inside the UI part. The user approved an explicit **eight-checkpoint checklist** with completion criteria: four UI fix batches, one UI close-out verification and three release packages. **Checkpoints 1–4 are committed as `f1a53b0` / `b414860` / `f591667` / `a88f461`; checkpoint 5 is user-committed as `187d103`; checkpoint 6 is verified and awaiting user review/commit. Two release-readiness checkpoints remain (7–8).** Later implementation checkpoints require separate approval; the plan does not authorize deployment.

See the [v1 completion checklist](v1-completion-checklist.md) for exact scope, source evidence, original-finding status, decisions and exit criteria.

## Approved checklist and implementation status

| #   | Phase | Checkpoint                                                                  | Implementation status                                                                                |
| --- | ----- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | 2J3   | Profile links from authorized directory/member contexts                     | User commit `f1a53b0` — [notes](checkpoint-1-profile-navigation.md)                                  |
| 2   | 2J3   | Operational-log frontend/server contract alignment                          | User commit `b414860` — [notes](checkpoint-2-log-contracts.md)                                       |
| 3   | 2J3   | Single-member removal and row-role pending/error feedback                   | User commit `f591667` — [notes](checkpoint-3-single-member-actions.md)                               |
| 4   | 2J3   | Listed search labels, list scrolling and original cross-module contrast     | User commit `a88f461` — [notes](checkpoint-4-accessibility.md)                                       |
| 5   | 2J3   | Final original-finding/module verification and UI close-out                 | User commit `187d103` — [close-out](checkpoint-5-ui-closeout.md)                                     |
| 6   | 2K1   | Versioned database migrations, constraints/indexes and upgrade verification | Approved fresh Flyway baseline; verified, uncommitted — [notes](checkpoint-6-database-migrations.md) |
| 7   | 2K2   | Agreed deployment environment, configuration, monitoring and recovery       | Proposed; environment/ownership decisions needed                                                     |
| 8   | 2K3   | Real-stack end-to-end, security/load acceptance and release checklist       | Proposed; usage/acceptance targets needed                                                            |

Start the next implementation only after approval of its concrete scope. New findings require visible triage and an approved scope/count update; they do not silently become more lettered checkpoints. A checkpoint count is not a time estimate, required commit count or guarantee that verification will reveal no blocker.

## Completed checkpoint record

| Work    | User commit / notes                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | `fe0fbd3`; [foundation](phase-1.md)                                                                                                                                                         |
| 2A      | `4cefaab`; [dependencies/formatting](phase-2a.md)                                                                                                                                           |
| 2B      | `73c5c1b`; [former-member access](phase-2b-membership-access.md)                                                                                                                            |
| 2C      | `b5f30cd`; [permissions/recovery](phase-2c-permissions.md)                                                                                                                                  |
| 2D      | `be77aae`; [archives](phase-2d-archiving.md)                                                                                                                                                |
| 2E      | `5c534ea`; [session revocation](phase-2e-sessions.md)                                                                                                                                       |
| 2F      | `5b779a3`; [membership batches](phase-2f-membership-batches.md)                                                                                                                             |
| 2G      | `123d218`; [task flows](phase-2g-task-flows.md)                                                                                                                                             |
| 2H1–3   | `661eb17`, `71ce11e`, `e2c6270`; [cache](phase-2h-1-cache-consistency.md), [user/privacy](phase-2h-2-user-editing-and-privacy.md), [sessions/feedback](phase-2h-3-sessions-and-feedback.md) |
| 2I1–3   | `97af042`, `b02e3b9`, `de1ce01`; [inbox](phase-2i-1-notification-inbox.md), [activity/navigation](phase-2i-2-activity-and-navigation.md), [measured performance](phase-2i-3-performance.md) |
| 2J1–2   | `af7359b`, `5fb35c5`; [shared task view](phase-2j-1-task-view-structure.md), [creation forms](phase-2j-2-creation-forms.md)                                                                 |
| 2J3a    | `dd2afd0`; [password reset/directory](phase-2j-3a-user-directory.md)                                                                                                                        |
| 2J3b    | `a4bad9e`; [navigation](phase-2j-3b-workspace-navigation.md)                                                                                                                                |
| 2J3c    | `f495e3b`; [comment/log feedback](phase-2j-3c-comment-log-feedback.md)                                                                                                                      |
| 2J3d    | `65da55b`; [edit/ownership dialogs](phase-2j-3d-edit-ownership-dialogs.md)                                                                                                                  |
| 2J3e    | `6715e81`; [member batches](phase-2j-3e-member-batches.md)                                                                                                                                  |
| 2J3f    | `1573530`; [account/authentication](phase-2j-3f-account-feedback.md)                                                                                                                        |
| 2J3g    | `ec1fabc`; [root crash recovery](phase-2j-3g-crash-recovery.md)                                                                                                                             |

The two recorded observations were approved and corrected in checkpoint 5. The wider review also found and, after approval, corrected member page-size handling, names for page-size/project-status controls and unused KPI-response identity fields. All original findings have current evidence in the close-out record; no unresolved blocker remains in the agreed UI scope. No UI deferral was required.

Restoration, additional Jira features, optional log enrichment, missing-page redesign and broad visual redesign remain separate decisions. UI close-out verifies completion of 2J3. Production-readiness sign-off still requires the agreed Phase 2K release checks; this is not deployment approval.
