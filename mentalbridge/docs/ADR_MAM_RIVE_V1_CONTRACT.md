# ADR: Mầm Rive V1 character contract and interaction policy

- Status: **proposed for MB-766 review**
- Decision gate: accepted when the MB-766 PR is approved and merged
- Decision: `MB-MAM-RIVE-001`, contract version `mam-rive-contract-v1`
- Date: 2026-10-27
- Scope: the global Mầm character on USER web surfaces (epic MB-765); mobile
  parity (MB-776) reuses the same contract
- Owning domain: web presentation. Care, Content and Journal/AI keep all
  business authority
- Follow-up implementation: MB-767 to MB-776
- Evidence: [mb-766-mam-rive-contract.md](evidence/mb-766-mam-rive-contract.md)

## Context

Mầm v0.3 is a Rive rig generated from `creative/mam-rive/build.mjs` and built
with the Rive CLI. It lives outside both Git repositories. The epic wants one
expressive character across USER pages, with explanations on request and short
celebrations of awards that a service has already verified.

Two contracts already constrain it:

- SupportPlan Companion: policy `support-plan-companion-policy-v1` and ADR 0040
  in the backend repository. They define intents, allowlisted context, a
  7-state UI vocabulary, frequency caps and no-interrupt zones. Both are still
  marked Proposed. This ADR builds on them and does not relax them.
- Rewards: ADR 0036 (resource rewards), 0037 (Bingo) and 0038 (achievements).
  All three are pull-only read models. No service emits an award event, and no
  read model has a "seen" flag.

Owner direction (MB-766 discussion, 2026-10-26):

- Mầm appears mainly when the user calls it. Example: a user is confused by
  SupportPlan, right-clicks a card, and Mầm explains it. Mầm then asks whether
  the user wants a suggestion on what to do first.
- The one automatic appearance is a short "bravo" for a newly earned
  achievement. Mầm then goes back to the dock and a cooldown starts.
- Failure mode to avoid: Mầm shows up too often. Mầm stays quiet unless it is
  needed.

## Decision summary

1. Freeze asset `mam-v03.riv` by SHA-256, and freeze its `MamControls` view
   model exactly as built.
2. V1 hosts use 10 of the 12 `behaviorState` values. `sad` and `rest` are
   reserved.
3. Only the MB-767 adapter writes to Rive. Features emit typed Mầm events.
   They never touch the runtime or the DOM of other features.
4. Mầm is summon-first. Automatic behaviour is limited to source-verified award
   celebrations and confirmed-save acknowledgements, within the budget below.
5. Release ships with the free MIT runtime and the CLI-built asset. No paid
   Rive plan is assumed. Production enablement is gated (see "Licensing and
   release gate").

## Frozen asset

| Field                                     | Value                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| File                                      | `mam-v03.riv`, 80,826 bytes                                                                      |
| SHA-256                                   | `2fbd1dacf9845f03e8710b61ab0110df616028467bd287fe9001a573a44e53a6`                               |
| Built by                                  | Rive CLI 1.7.0, `rive <rig> --once` (unsigned, no login)                                         |
| Rebuild                                   | Deterministic: rebuilding the rig on 2026-10-27 gave the same hash, with 0 errors and 0 warnings |
| Artboard                                  | `companion_main`, 512×512, no artboard fill (transparent)                                        |
| State machine                             | `MamBehaviorController`, layers `Behavior`, `Face`, `Attention`                                  |
| View model                                | `MamControls`, instance `Default`                                                                |
| Scripts / embedded images / fonts / audio | none (0 `Script` elements), so no signing is needed                                              |

Source of truth for the art is the generator in `creative/mam-rive/`:
`build.mjs`, `source/mam_v03_rive_layers.svg` and `rig/rive.yaml`. Hand edits to
`scene.rml` are overwritten by the generator. A changed hash is a new contract
version and needs a new visual QA pass.

MB-767 lands the asset in the web repository:

- `public/mam/mam-v03.riv` holds the file with the hash above. Budget: at most
  100 KB.
- `design-source/mam-rive/` holds the generator inputs. Next.js does not serve
  this folder.
- The static fallback is a transparent SVG of the v0.3 `idle` pose, generated
  from the same `build.mjs` art tree. The v0.4 PNG in `creative/mam-companion/`
  is different art and is not used.
- The Rive runtime and its WASM load lazily, and only on routes where the dock
  is visible. They never enter the initial route bundle.

The earlier
`creative/mam-companion/` POC and the inline "Mầm An" SVG loading mascots
(`features/assessment/components/MamAnLoadingState.tsx`) are not part of this
contract and stay unchanged.

## Control contract

| Property             | Type                                                                                                                                                                               | Rule                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `behaviorState`      | enum `MamBehavior` (12 values, IDs fixed in this order: `idle, curious, listening, thinking, gentle, explaining, light_success, celebrate_soft, celebrate_hero, rest, sad, happy`) | Looping poses blend in 260 ms (`sad` 600 ms). The face layer switches in 0 ms                |
| `attentionDirection` | number −1…1, clamped                                                                                                                                                               | Moves only the pupils. Measured ±6 artboard px at the extremes                               |
| `celebrationTier`    | enum `none, soft, hero`                                                                                                                                                            | Picks a celebration when `behaviorState` is not itself a one-shot                            |
| `playOnce`           | trigger                                                                                                                                                                            | Required to start any one-shot. Setting a one-shot enum value alone plays nothing (verified) |
| `returnToDock`       | trigger                                                                                                                                                                            | Interrupts and returns to `idle`                                                             |
| `reducedMotion`      | boolean                                                                                                                                                                            | `true` routes to the static `rest` pose and blocks every one-shot                            |
| `isVisible`          | boolean                                                                                                                                                                            | `false` hides the character and its shadow. It takes priority over everything else           |

One-shots last 1.2 s (`light_success`), 0.9 s (`celebrate_soft`) and 1.5 s
(`celebrate_hero`). When one finishes, the asset writes `behaviorState=idle` and
`celebrationTier=none` itself. The CLI data dump shows `idle` at 1.3 s, 1.0 s and
1.6 s respectively. The adapter must read those values back. It must not assume
its last write is still current.

### V1 behaviour vocabulary

| `behaviorState`  | V1 meaning (a UI event, never the user's mood)                                               | Set by                                   |
| ---------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `idle`           | Available in the dock                                                                        | default, `returnToDock`                  |
| `curious`        | User summoned Mầm on a target; the starter menu is open                                      | summon                                   |
| `thinking`       | An explicit request is pending                                                               | request started                          |
| `explaining`     | An explanation bubble is shown                                                               | request succeeded                        |
| `listening`      | Mầm offered an optional next step and waits for the user's choice                            | offer shown                              |
| `gentle`         | Sensitive or failed-request context: calm template text                                      | request failed, sensitive review surface |
| `happy`          | A verified-award bubble is open                                                              | celebration bubble                       |
| `light_success`  | One-shot: a confirmed save or a Content-verified Bingo item                                  | confirmed source event                   |
| `celebrate_soft` | One-shot: a verified achievement (not the day's hero)                                        | celebration scheduler                    |
| `celebrate_hero` | One-shot: the first verified achievement of the day                                          | celebration scheduler                    |
| `sad`            | **Reserved; not used in V1.** It must never mirror the user's emotion, journal or assessment | none                                     |
| `rest`           | **Reserved for the asset's reduced-motion pose.** Hosts do not set it                        | asset                                    |

SupportPlan Companion states map onto this vocabulary as follows:

| ADR 0040 state      | Mầm state                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `idle`              | `idle`                                                                                         |
| `greeting`          | none in V1: Mầm does no route-entry greeting (the policy allows at most one, so zero complies) |
| `thinking`          | `thinking`                                                                                     |
| `encouraging`       | `explaining`                                                                                   |
| `celebrating-light` | `light_success`                                                                                |
| `calm-empathetic`   | `gentle`                                                                                       |
| `waiting`           | `listening`                                                                                    |

`listening` and `explaining` occur only inside a flow the user summoned. Mầm
never enters them on its own, for example while the user reviews Plan or Adjust
choices.

### Arbitration

When inputs conflict, the first matching rule wins:

1. `isVisible=false`, meaning the user hid Mầm, the route is excluded, or the
   host is unmounting.
2. `reducedMotion=true`. The cause is the OS `prefers-reduced-motion` setting
   or the user's Mầm motion preference. The adapter sets only this boolean. The
   asset then shows `rest` by itself, and the host keeps showing bubble text.
3. A suppression zone is active (see "No-interrupt zones"). Mầm stays static in
   the dock and accepts no automatic event. Entering a zone takes effect at
   once:
   - a running one-shot stops with `returnToDock`;
   - an automatic bubble closes and host motion stops;
   - focus does not move and nothing is announced.

   A request still pending during suppression keeps its result silently. The
   result shows only if the user opens the dock after the zone ends. A
   celebration that was interrupted goes back to the queue (see "Celebration
   policy and budget").

4. An explicit user summon or request, including its pending, answer, offer and
   failure states.
5. A running one-shot. It completes, unless rule 1, 2, 3 or 4 interrupts it
   with `returnToDock`.
6. A queued celebration, released only by the budget.
7. `idle`.

Gaze (`attentionDirection`) points toward the active anchor. It returns to 0
when Mầm is in the dock. Gaze never follows the pointer continuously.

## Ownership

| Part                                                | Owner                                                                                 | Rule                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Asset and generator                                 | creative source plus MB-767 commit                                                    | Change only through `build.mjs` and a new hash                                                                        |
| Runtime adapter (`MamControls`)                     | MB-767                                                                                | The only code that loads the runtime or writes view-model properties                                                  |
| Global host: one dock, anchored bubble, preferences | MB-768                                                                                | Exactly one character instance per tab. Survives client route changes                                                 |
| Target registry and context                         | MB-769                                                                                | Targets register a typed descriptor: surface, allowed intents, and context IDs taken from props. No DOM text scraping |
| Feature integrations                                | MB-770 Resources, MB-771 Emotion/Journal, MB-772 SupportPlan, MB-774 rewards          | Emit Mầm events only                                                                                                  |
| Celebration scheduler and budget                    | MB-773                                                                                | The only producer of `celebrate_*`                                                                                    |
| Gate, flag, rollout                                 | MB-775                                                                                | Default off                                                                                                           |
| Explanations and suggestions                        | Care, through the existing companion endpoint (ADR 0040); Journal/AI only behind Care | Mầm displays the text. It never changes plan, journal, reward, consent, booking or payment state                      |

## Event taxonomy

| Event                                      | Producer                                                   | Payload                                                              | Effect                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `mam.summon`                               | registered target via context menu, keyboard or long-press | `targetId`, `surface`, intents                                       | Mầm moves to the anchor, `curious`, starter menu                                               |
| `mam.request.started`                      | starter chosen                                             | `intent`, context IDs                                                | `thinking`, polite status                                                                      |
| `mam.request.succeeded`                    | Care response                                              | text, optional next-step offer                                       | `explaining`. If an offer exists, then `listening` after the text                              |
| `mam.request.failed`                       | timeout, quota, policy or network failure                  | reason code                                                          | `gentle` plus approved template copy, never an invented answer                                 |
| `mam.offer.accepted`                       | user                                                       | target surface                                                       | Shows the next step (see "Explanation sources in V1"). Mầm suggests only after the user agrees |
| `mam.dismiss`                              | Esc, close, outside click, route change                    | —                                                                    | `returnToDock`. Focus returns to the target                                                    |
| `mam.save.confirmed`                       | feature, after the authoritative response                  | source reference                                                     | `light_success` in place, no bubble                                                            |
| `mam.award.verified`                       | MB-774 reward watcher                                      | presentation key (see "Award keys"), kind, `unlockedAt`/`verifiedAt` | Enqueue in the celebration scheduler                                                           |
| `mam.suppress.enter` / `mam.suppress.exit` | sensitive surfaces                                         | zone                                                                 | Start or end suppression                                                                       |
| `mam.pref.changed`                         | user                                                       | `hidden`, `muted`, `motion`                                          | Apply immediately                                                                              |

### Explanation sources in V1

The only implemented model-backed path is Care's
`POST /api/v2/support-plans/{supportPlanId}/actions/{actionId}/companion-explanation`
(`care-service-v1.yaml:1672`). It serves intent `EXPLAIN_ACTION` only, for
surfaces `TODAY` and `PLAN`, and returns a deterministic template when the
provider is unavailable. Policy v1 states that additive intent or context
changes require a v2. V1 therefore uses these sources:

| Starter (Vietnamese label)                      | Where                                                                          | Source                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Mầm giải thích" on a plan action               | SupportPlan Today and Plan action cards                                        | Care endpoint above (`EXPLAIN_ACTION`)                                                                                                                                                                                                                                                                 |
| "Mầm giải thích" on any other registered target | SupportPlan Progress/Adjust sections, dashboard cards, reviewed Resource cards | Reviewed deterministic copy that the target's descriptor declares per component type. No model call                                                                                                                                                                                                    |
| "Nên bắt đầu từ đâu?"                           | SupportPlan, after any explanation, or from the dock                           | The Today focus that `selectTodayFocus` (`features/support-plan/workspace/workspace-model.ts:126`) already derives from Care's plan and occurrences: resume, review due, or the earliest open occurrence. Template text plus a `NAVIGATE` focus or link to that card. No model call and no new ranking |

Generated phrasing for `SUGGEST_NEXT_STEP`, `EXPLAIN_FOCUS`,
`EXPLAIN_REVIEW_OPTION` or `SUMMARIZE_PROGRESS` needs Care backend and policy
work in MB-772 first. Model-backed explanations outside SupportPlan need their
owner's intent and context contract. The web BFF currently accepts only
`EXPLAIN_ACTION` (`lib/care/support-plan-action-validation.ts:140`). Unknown
intent or context fails closed.

## Interaction policy

### Summon (the primary path)

- Right-click on a registered target opens the Mầm starter menu. The native
  browser menu stays in these cases:
  - everywhere else on the page;
  - on links, inputs and editable text;
  - when the user has a text selection inside the target.
- Keyboard: on a focused target, press the `ContextMenu` key or `Shift+F10`.
- Touch: long-press of 500 ms on a target, built from pointer events, because
  iOS fires no `contextmenu` event. Moving more than 10 px or starting a text
  selection cancels the press. The dock button remains the touch path that
  always works.
- The dock button also offers "Hỏi Mầm về trang này" for the current surface.
- The menu lists only approved starters, for example "Mầm giải thích" and
  "Nên bắt đầu từ đâu?". Each is a button with an accessible name.
- Hover and focus alone never call a model, move focus or announce anything
  (same as policy v1).
- One bubble at a time. While a request is pending, a repeated summon shares
  the pending state.

### No-interrupt zones

In these zones Mầm never auto-appears, never celebrates, never announces
anything and never moves focus. It stays as a static dock or is hidden:

- Journal or other long-form writing;
- assessment or reassessment questions, initial check, emotion check-in entry;
- consent, privacy, payment, checkout, service credits, booking and
  plan-mutation confirmation;
- any open modal or `dialog` (`[aria-modal="true"]`, `dialog[open]`), and
  validation recovery or unsaved forms;
- crisis and safety support, including while `CrisisSupportWidget` is open;
- an assistive-technology focus sequence inside a primary action;
- a hidden document (`document.visibilityState !== 'visible'`).

### Surface matrix

| Surface                                                                                                                                                                                                                        | Dock                       | Summon                                               | Automatic                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `/dashboard` (outside the emotion check-in entry)                                                                                                                                                                              | yes                        | registered cards, deterministic copy                 | celebrations within budget                                                 |
| `/support-plan` (Today, Plan, Progress, Adjust)                                                                                                                                                                                | yes                        | registered targets, per "Explanation sources in V1"  | confirmed-save `light_success` only. No award celebrations under policy v1 |
| `/resources`, `/resources/[resourceId]`                                                                                                                                                                                        | yes                        | reviewed Resource cards (MB-770), deterministic copy | Bingo `light_success`; celebrations within budget                          |
| `/achievements`                                                                                                                                                                                                                | yes                        | none in V1                                           | celebrations within budget                                                 |
| `/support-guides`, `/support-guides/[supportGuideId]`                                                                                                                                                                          | yes                        | none in V1                                           | none                                                                       |
| `/journal` list view                                                                                                                                                                                                           | static dock                | none in V1 (MB-771 decides)                          | none                                                                       |
| Journal authoring, `/assessment/*`, `/assessments`, `/initial-check`, `/safety-directory`, `/subscription`, checkout, appointment booking, `/messages`, community routes, `/ai-companion`, admin, specialist, anonymous routes | hidden (`isVisible=false`) | none                                                 | none                                                                       |

`/ai-companion` already has its own conversation surface, so a second character
there would duplicate it.

SupportPlan stays under policy v1. Policy v1 requires a v2 for any additive
automatic trigger (`support-plan-companion-policy-v1.md:253`), and an award
celebration on SupportPlan would be one. This ADR therefore adds none there.
Queued celebrations wait while the user is on `/support-plan` and play on the
next eligible route. Policy v1's per-surface, per-visit and dismissal rules
(policy lines 126–146) remain the floor on SupportPlan. The global budget below
is added on top of them and replaces none of them. Award celebrations on
SupportPlan need an approved policy v2 first.

## Celebration policy and budget

Sources. Only these trigger a celebration. Each is newly observed by a client
read of the owner's read model:

| Source                                   | Eligible                                                                                                                                         | Presentation                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Achievement (`GET /api/v1/achievements`) | `status=EARNED` with a non-null `unlockedAt`                                                                                                     | `celebrate_hero` or `celebrate_soft`, plus a `happy` bubble that names the achievement title |
| Bingo item                               | `evidence=CONTENT_VERIFIED`                                                                                                                      | `light_success` in the dock, no bubble                                                       |
| Never celebrated                         | `SELF_CONFIRMED` Bingo, `GRANDFATHERED`, `DEFERRED`, `SOURCE_UNAVAILABLE`, resource XP grants and levels, streaks, any value Mầm computes itself | —                                                                                            |

### Award keys

Each award gets a presentation key built only from existing source fields. The
same key is used in events, in the queue and in the watermark. No backend award
ID or second ledger is introduced.

| Source      | Key                                                                     |
| ----------- | ----------------------------------------------------------------------- |
| Achievement | `achievement:{definitionId}:{unlockedAt}`                               |
| Bingo item  | `bingo:{weekStart}:{timeZone}:{position}:{resourceId}:{contentVersion}` |

If an award is corrected away and later earned again with a new `unlockedAt`,
it gets a new key and is eligible again. If it comes back with the same
`unlockedAt`, it was already seen and stays silent. A Bingo item keeps its board
scope, so a new week never inherits the previous week's seen items.

### Observation, seeding and reconciliation

The watermark of seen keys is presentation state only, not a reward ledger.

- **Storage.** The watermark, budget counters and queue share one `localStorage`
  record per device, keyed by the signed-in user ID. Two users on one device
  never share it. "Day" is the device's local calendar day.
- **Reservation.** Before any automatic award playback, the scheduler takes an
  exclusive per-user lock with `navigator.locks.request`. Under that lock it
  re-reads the record, checks the budget, writes the reservation and marks the
  keys as seen. Only then does it play. `storage` events only refresh other
  tabs' views; they never grant a slot. If the Web Locks API or storage is
  unavailable, no award plays automatically.
- **Per-source baseline.**
  - Achievements: each `sources[].domain` is seeded silently the first time it
    reads `availability=AVAILABLE`. The keys of that domain's currently
    `EARNED` items go into the watermark without playing. A domain that reads
    `UNAVAILABLE` or `DEFERRED`, or a read that fails, never sets a baseline.
  - Bingo: each board (`weekStart` + `timeZone`) is seeded silently on its first
    successful read.
  - Cut-off: an award is eligible only if its `unlockedAt` or `verifiedAt` is
    within the last 24 h at the time of observation. A late baseline therefore
    still cannot replay history.
- **Reads.** MB-774 reads the owner's read models once when a dock route mounts
  and again when the window regains focus. Reads are spaced at least 5 minutes
  apart, and there is no background polling. A read that a feature page already
  made (for example `/achievements`) may be reused.
- **Reconciliation.** Every successful owner read reconciles the queue. An entry
  whose key is no longer present and eligible is removed, and so are all entries
  while `visibilityState` is not visible. A queued entry plays only if the most
  recent successful read is at most 5 minutes old and still lists it as
  eligible. Otherwise it waits for the next read under the same cadence. If
  verification is unavailable, the entry is dropped. The queue is never
  evidence of an award.
- Another device may celebrate the same award once. That is accepted, because
  the award itself lives in Content.

Budget, per device and local day:

- At most **1 automatic appearance per 30 minutes** and **3 per day**. Every
  automatic award appearance counts, including a bubble-free Bingo
  `light_success`. The slot is consumed at reservation, and the 30-minute window
  runs from the reservation time.
- At most **1 `celebrate_hero` per day**. Later achievements that day use
  `celebrate_soft`. The tier is decided when the appearance plays, not when the
  award is queued.
- Awards observed in the same read, or within 10 s of each other, are
  coalesced into one appearance. Example: three achievements together give one
  hero for the first, and the bubble reads "… và 2 thành tựu khác".
- The bubble closes on dismiss, or after 8 s without hover or focus. Hover or
  focus pauses the timer, and leaving restarts the full 8 s. Mầm then returns
  to the dock.
- While suppressed, hidden, muted or in reduced motion, nothing plays. While
  suppressed, the entry waits in the queue until the zone ends, under the
  reconciliation rules above. An interrupted appearance returns its slot to
  the budget. Queued entries are dropped at the end of the session or after
  24 h. The award stays visible in its own gallery, so nothing is lost.
- In reduced motion there is no automatic appearance and no one-shot. A pending
  award's bubble text shows when the user opens the dock.
- Copy never mentions streak continuation, XP, scores, recovery or obligation.
  It contains no "come back tomorrow" pressure.

Explicit summons have no Mầm-side cap. Server quota and rate policy still apply.
Confirmed-save `light_success` is direct feedback to the user's own action. It
does not use the budget but obeys hidden, muted, motion and suppression.

## User controls

| Control        | Effect                                                                                | Persistence                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Hide Mầm       | `isVisible=false`, no automatic events. Summon is off until shown again               | Per device. MB-768 chooses the storage key, following the existing `mentalbridge_support_plan_companion_*` pattern |
| Mute           | No automatic appearances and no live-region announcements. Requested text still shows | Session (policy v1). Cross-session needs the preference contract MB-653 names                                      |
| Animations off | `reducedMotion=true`. The OS `prefers-reduced-motion` setting forces it on            | Per device                                                                                                         |

Controls are reachable from the dock by keyboard. Hiding Mầm never hides
authoritative plan, safety, save, validation or error feedback.

## Visual and layout rules

- Render sizes are 72 px for the mobile dock, 96 px for the desktop dock and
  the anchored bubble character, and 240 px for the transient hero overlay. At
  72 and 96 px the expressions are subtle by design, so the meaning always
  comes from the bubble text.
- The canvas stays transparent and the host provides no background. The
  palette is fixed by the asset. The hood fill `#5E877F` measures 3.41–4.00:1
  on the light `--bg`, `--surface` and `--surface-soft` tokens, and 3.72–4.59:1
  on the dark `--color-app-bg`, `--color-surface` and `--color-surface-soft`
  tokens. That meets the 3:1 non-text contrast minimum.
- Layering:
  - Mầm sits below toasts (`z-index` 100200) and below `CrisisSupportWidget`
    (120000).
  - It never covers the crisis widget, primary actions, sticky composers or a
    focused element.
  - Native modal dialogs render in the top layer above it.
  - The desktop dock sits bottom-left, because the crisis widget sits
    bottom-right. MB-768 owns mobile placement.
- Host motion (dock travel and bubble) uses the product tokens `--motion-base`
  and `--motion-medium` with `--ease-standard`. The hero's off-dock flight
  (about 1.4 s in the art spec) is a host transform. It is skipped in reduced
  motion.
- Bubble copy is Vietnamese, short, non-clinical, and it labels generated
  phrasing as Mầm's explanation, separate from authoritative facts.

## Failure and fallback

| Case                                               | Behaviour                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Asset fetch or decode fails, or WASM init fails    | Static SVG Mầm with the same text and controls. No retry loop. The page is never blocked                                       |
| Runtime unsupported or canvas context lost         | Same static fallback                                                                                                           |
| Rive WASM                                          | Self-hosted from the app origin, never fetched from a third-party CDN at runtime. A future CSP must allow `'wasm-unsafe-eval'` |
| Explanation request fails, times out or hits quota | `gentle` plus approved template text for that intent. Mầm never invents an answer                                              |
| Route change during a request or bubble            | Request result discarded, `returnToDock`                                                                                       |
| Flag off                                           | Host not mounted. Existing SupportPlan Companion UI unchanged                                                                  |

## Licensing and release gate

Findings, checked 2026-10-27:

- Web runtimes `@rive-app/react-canvas` 4.37.1 and `@rive-app/canvas` 2.47.1
  are MIT-licensed. No runtime fee applies.
- Rive Terms of Service (last updated 2026-05-20), D-4: "you own your User
  Content". The Terms set no explicit commercial-use limit for free individual
  accounts. Section C.6 requires the Enterprise plan for organisations above
  USD 10M annual revenue.
- Pricing page: the Free plan includes "CLI with limits" and "Export .riv files
  with a splash screen". Cadet ($9/seat/month) removes the splash.
- CLI reference: only `--publish` may watermark, and a clean publish needs a
  Cadet-or-higher file binding. `--once` writes an unsigned `.riv`. A file
  without scripts needs no signing (bundled CLI docs, `publishing.md`).

Decision:

- Ship the CLI `--once` build, signed out. Each of these commands is avoided
  for a different reason:
  - `rive login` authenticates an account;
  - `rive push` binds the project to a file in that account;
  - `--publish` may watermark the build unless it is bound to a Cadet-or-higher
    workspace.

  None of them is needed for a script-free file.

- Do not assume a paid plan.
- **Production enablement (MB-775) requires all of these:**
  1. Browser proof in MB-767 that the frozen file shows no splash or watermark
     in the shipped web runtime.
  2. Owner sign-off that the Free-plan CLI path is acceptable under the Terms
     current at release.
  3. Confirmation that the Enterprise revenue clause does not apply.
- If (1) shows a splash, or (2) is refused, keep the flag off. The owner then
  chooses between a Cadet seat and shipping the static fallback only.

## Out of scope

- AI Voice and LiveKit (MB-754), lip sync and visemes (`talk` is a static
  mouth), video, specialist consultation.
- Autonomous Care, Journal or Content mutations.
- New reward rules, XP, achievements or streaks.
- Sentiment profiling, and reading raw Journal, emotion, assessment or chat
  content.
- Arbitrary DOM scraping.
- Sound. V1 is silent.
- Mobile implementation (MB-776 reuses this contract).

## Consequences

- MB-767 can type the adapter directly from the tables above. Any change to
  the enum order or property names is a breaking contract change.
- The policy-v1 frequency rules remain the floor. This ADR is stricter: no
  greeting, and a single global budget.
- ADR 0040 and policy v1 are still Proposed. If they change at acceptance, the
  mapping table above is updated in the same change.
