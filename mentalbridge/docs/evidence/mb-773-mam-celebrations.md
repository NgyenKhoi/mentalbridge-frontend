# MB-773 Mầm celebration director

Scope: web only. No backend or contract change. Authority: `docs/ADR_MAM_RIVE_V1_CONTRACT.md`, "Celebration policy and budget".
MB-774 will dispatch the real owner reads (`dispatchMamAwardRead`); MB-773 proves the director with fake snapshots.

## Policy as built

| Rule | Behaviour | Where |
| --- | --- | --- |
| Eligible sources | Achievement `EARNED` with `unlockedAt` (hero or soft plus `happy` bubble). Bingo `CONTENT_VERIFIED` (`light_success`, no bubble). A collection with `visibilityState=HIDDEN` counts as unavailable. | `awardsFromAchievements`, `awardsFromBingo` |
| Never | `SELF_CONFIRMED`, `GRANDFATHERED`, `DEFERRED`, `SOURCE_UNAVAILABLE`, `UNEARNED`, XP, levels, streaks | same |
| Keys | `achievement:{definitionId}:{unlockedAt}`, `bingo:{weekStart}:{timeZone}:{position}:{resourceId}:{contentVersion}` | `achievementKey`, `bingoKey` |
| Baseline | First available, visible read of a scope (achievement domain, Bingo board) seeds `seen` silently. Unavailable or hidden-document reads never seed. | `observeMamRead` |
| Cut-off | Queued only if the award is at most 24 h old at the read | `observeMamRead` |
| Reconciliation | Every read replaces `lastReads[scope]` and drops queued entries it no longer lists. A hidden-document read clears the queue of its kind. | `observeMamRead` |
| Freshness | An entry plays only if its scope was read at most 5 min ago and still lists it. The 24 h cut-off also filters what a read lists as eligible, so an award that ages past it while queued drops at the next read. | `observeMamRead`, `nextMamAppearance` |
| Budget | 1 appearance per 30 min (from the reservation), 3 per local day, 1 hero per day. The tier is decided at play time. Bingo counts. | `nextMamAppearance` |
| Coalescing | Nothing is released before the earliest ready entry has waited 10 s; everything queued by then plays as one appearance, across scopes and separate reads. Copy names the first achievement plus the count of the others. Bingo entries in an achievement group add no effect and no copy. | `nextMamAppearance`, `mamAppearanceText` |
| Wake-ups | A release attempt runs on each observed read, on a route change, and once more at the deadline the attempt reports (coalescing window end or budget reopening), while the evidence is fresh. No polling. | `mamRetryAt`, `use-mam-celebrations.ts` |
| Reservation | Under `navigator.locks` `mentalbridge-mam-celebrations:<accountId>`: re-read, budget check, reservation, keys seen, entries removed. No storage, lock, session or account: nothing plays. | `reserveMamNext` |
| Interruption | While the one-shot runs: slot returned, entries requeued (`seen` stays). After it ends only the bubble closes. A reservation that completes after unmount, an account change or a route change is returned to the account it was made for and never adopted. | `use-mam-celebrations.ts`, `interruptMamAppearance` |
| Release conditions | Route `/dashboard`, `/achievements`, `/resources[/id]`; character ready; not hidden, muted, reduced (pref or OS), suppressed; no summon or menu; dock not stepping aside for a page action. Release waits for the 10 s coalescing window. | `MamDock.tsx`, `isMamCelebrationRoute` |
| Bubble | `happy`, one sentence, link "Xem bộ sưu tập" (not on `/achievements`), never moves focus, closes on Esc, outside press, close, or 8 s without hover or focus (leaving restarts 8 s). It steps aside if it covers a page action. | `MamCelebrationBubble` |
| Reduced motion or muted | Nothing plays. A fresh achievement sentence shows as a note when the dock menu opens; its keys become seen; no budget. | `useMamCelebrationNote` |
| Queue lifetime | An entry keeps the list of tab sessions that observed it. It is dropped after 24 h, or when none of those tabs touched the record in the last 30 min (liveness is last-touch, not a heartbeat). A dropped key counts as seen, so an identical later read does not queue it again. | `pruneMamRecord` |
| Recovery | A malformed `seen` resets the whole record, so the next read rebaselines silently. Other malformed parts are dropped alone. | `parseMamRecord` |

The Jira proposal "hero 1 per session plus a 24 h cooldown" is superseded by the ADR budget above.

## Verification

Run from `mentalbridge/` in the story worktree. Build and E2E ran from a `subst` drive (mapping removed afterwards). After Codex round 1 (7 findings) every gate was rerun.

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS (0 warnings) |
| Format | `npx prettier --check features/mam tests/e2e/mam-celebrations.spec.ts` | PASS |
| Unit, `features/mam` | `npx vitest run features/mam` | PASS, 11 files, 184 tests (55 in `mam-celebrations.test.ts`, 5 in `use-mam-celebrations.test.tsx`) |
| Build | `npm run build` from the `subst` drive | PASS |
| E2E | `npx playwright test tests/e2e/mam-celebrations.spec.ts mam-dock.spec.ts mam-resource-cards.spec.ts --reporter=line --workers=1` | PASS, 25 of 25 (9 new, 10 `mam-dock`, 6 `mam-resource-cards`) |
| Motion frames, taste lint, web-design-guidelines review | owner UI gate, main session | NOT_RUN here |

Unit and hook coverage of the round 1 findings: two distinct tab sessions interleaved, staggered reads across scopes inside the window, an award aging past the cut-off, session end followed by an identical read, a reservation completing after unmount or an account change, a corrupt `seen` with an intact baseline, the minute 29 to 31 budget boundary, and eligible-to-eligible navigation.

E2E scenarios (fake `mam:award-read` snapshots, `page.clock`): silent baseline, hero plus bubble plus hover pause plus 8 s close at 1440 and 375, reload and identical read replay nothing, coalesced copy, 30 min wait and soft tier, bubble steps aside from a page action, Bingo `light_success` without bubble, dialog defers, `/journal` defers then `/achievements` plays, reduced-motion note on the dock menu. Each waits out the 10 s coalescing window.

## Known limits

- MAM mixed-scope retry: the retry deadline uses the earliest queued scope's evidence expiry. A later scope that remains fresh can wait for another read or route change if the earliest scope expires before the budget opens.
- MAM midnight retry: when the daily cap is full, no timer wakes at midnight even if queued evidence would still be fresh. Another read or route change reevaluates the budget.
- Tab liveness is last-touch within 30 min, not a heartbeat; an idle tab's pending award can be retired and is then not replayed.
- One-shot end comes from timers (1.4, 1.1, 1.7 s: the asset's idle times plus 0.1 s), not from an asset callback.
- The scenarios run on `/achievements` and `/resources` because `/dashboard` has page actions under the dock, where the dock correctly steps aside and the release waits.
- The reads in tests are fake: no code reads `/api/achievements` or Bingo until MB-774.
- `lastReads` and `baselined` are never pruned (a few bytes per scope).
