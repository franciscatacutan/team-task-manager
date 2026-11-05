# Production readiness roadmap

Updated November 5, 2026 against user commit `b414860`; checklist checkpoint 3 is verified and uncommitted.

The objective remains to strengthen the existing v1, improve its structure/UI flows, and verify a production release before separately scoping more Jira-style capabilities. Implementation stays checkpoint-based, with scope/policy choices approved first and every commit made by the user.

## Current position

| Area               | Status                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phases 1–2I        | Completed: foundation/security/contracts, dependencies/formatting, membership/permissions, archives/sessions, task flows, cache/session consistency, notifications/activity and measured performance fixes |
| Phase 2J parts 1–2 | Completed: shared task views/module boundaries and consistent creation forms                                                                                                                               |
| Phase 2J part 3    | In progress: seven historical fix checkpoints and checklist checkpoints 1–2 committed; checkpoint 3 verified/uncommitted; checkpoints 4–5 remain                                                           |
| Phase 2K           | Proposed: database release path, deployment/operations and final release verification                                                                                                                      |

The previous “four unfinished parts” estimate counted one broad UI-review part plus three release packages. It obscured the work still inside the UI part. The user approved an explicit **eight-checkpoint checklist** with completion criteria: four UI fix batches, one UI close-out verification and three release packages. **Checkpoints 1–2 are committed as `f1a53b0` / `b414860`; checkpoint 3 (single-member safeguards) is verified and awaiting user review/commit. Five remain.** Later implementation checkpoints require separate approval; the plan does not authorize deployment.

See the [v1 completion checklist](v1-completion-checklist.md) for exact scope, source evidence, original-finding status, decisions and exit criteria.

## Approved checklist and implementation status

| #   | Phase | Checkpoint                                                                  | Implementation status                                                            |
| --- | ----- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | 2J3   | Profile links from authorized directory/member contexts                     | User commit `f1a53b0` — [notes](checkpoint-1-profile-navigation.md)              |
| 2   | 2J3   | Operational-log frontend/server contract alignment                          | User commit `b414860` — [notes](checkpoint-2-log-contracts.md)                   |
| 3   | 2J3   | Single-member removal and row-role pending/error feedback                   | Approved; verified, uncommitted — [notes](checkpoint-3-single-member-actions.md) |
| 4   | 2J3   | Listed search labels, list scrolling and original cross-module contrast     | Proposed; bounded inventory in checklist                                         |
| 5   | 2J3   | Final original-finding/module verification and UI close-out                 | Proposed                                                                         |
| 6   | 2K1   | Versioned database migrations, constraints/indexes and upgrade verification | Proposed; migration strategy needed                                              |
| 7   | 2K2   | Agreed deployment environment, configuration, monitoring and recovery       | Proposed; environment/ownership decisions needed                                 |
| 8   | 2K3   | Real-stack end-to-end, security/load acceptance and release checklist       | Proposed; usage/acceptance targets needed                                        |

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

Two pre-existing observations from checkpoint 2 (event-label inference and narrow project-container scrolling) are recorded for explicit triage before UI close-out; see the checklist. They are not silently fixed or accepted deferrals.

Restoration, additional Jira features, optional log enrichment, missing-page redesign and broad visual redesign remain separate decisions. Passing the UI close-out completes 2J3; production-readiness sign-off requires the agreed Phase 2K release checks.
