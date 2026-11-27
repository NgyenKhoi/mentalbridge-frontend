# MB-641 production translation map (not implementation evidence)

## Web

- Keep `AuthenticatedShell`, route headings and conditional `journeyTabs` source
  owned. Read v3 `/api/v2/support-plans/current` and `/current-draft` first; select
  representation-specific UI by `representationMode`. Never pretend native
  actions are v1 resource slots. A V2_RESOURCE_ADAPTER continues the current v1
  behavior and history; a NATIVE_V3 uses the real action model.
- Native proposal uses saved explicit personalization intent, existing evaluation
  admission and reviewed defaults. Show optional Emotion purpose and frequency
  before explicit activation. A current plan needs governed replacement review,
  not a second current plan or forced conversion.
- `SupportPlanSchedule` presently loads v1 occurrence objects with embedded
  source titles. Native `ActionOccurrence` objects instead link `actionId`;
  join only against the owned projection and display `presentation` plus the
  matching schedule. Do not invent resourceId/contentVersion for an Emotion action.
- A feature-owned Emotion activity block owns entry and explicit check states.
  Add no duplicate DailyEmotion form inside SupportPlan. The reusable factual
  `EmotionProgress` stays owner API backed and independent of plan completion.
- Entry URL should allowlist exactly typed identifiers, for example:
  `/dashboard?occurrenceId=<uuid>&actionId=<uuid>#emotion-check-in`. Decode with
  generated/runtime validators. There is no arbitrary `returnTo` redirect, fact
  identity, token, mood value, score or note in the URL.
- Resolve the occurrence from the owned current plan/window (or a bounded owner
  read when supplied) before showing contextual identity. An unrecognized,
  cancelled or replaced origin must not target a nearby action. Safe recovery
  returns to the current plan. Query IDs are navigation hints, not authority.
- `DailyEmotionCheckIn` remains canonical on `/dashboard`; the origin strip sits
  inside `.ref-panel-mood` next to its heading and explains save versus completion.
  Add a stable anchor and focus/scroll behavior for this context only. Keep the
  dashboard hero, bento grouping and all unrelated columns unchanged.
- The canonical form currently derives creation timezone from browser Intl.
  A plan schedule can freeze another IANA name with the same UTC offset. Resolve
  the exact owner occurrence/schedule context before supplying a creation zone,
  or explain the mismatch and leave activity history unchanged. Do not trust a
  free-form timezone/date query or treat equal offsets as equal stored zones.
- Today's check-in form cannot create a historical/future record. For another
  local day, show the limitation and allow only an explicit check of any existing
  owner fact. Do not backdate or suggest today's record completes yesterday.
- Return URL carries the same IDs to `/support-plan`; select the appropriate
  existing tab/day, focus the exact activity heading and show **Kiểm tra ghi nhận**.
  Do not call a completion/reconcile command on mount, refetch or `onPersisted`.
- POST reconciliation has no body, If-Match or user-supplied completion fact.
  Disable only its own pending action; other rows/drafts remain available. Validate
  occurrence/action/day identity in the response before replacing that row.
  Persisted `occurrenceState` and fresh `sourceState` remain separate.
- 503 preserves accepted history; 409 mismatch/preactivation/closed/current-plan
  reasons explain the failed user action. Refresh from owner after conflict but
  retain unrelated edits. Repeated accepted fact preserves version/time.

## Mobile

- Existing `Screen` uses SafeAreaView and one natural ScrollView with max-width560;
  User Stack has `animation:'none', headerShown:false`. No new tab bar/app bar.
- `SupportPlanRoute` can read allowlisted `occurrenceId/actionId` alongside its
  existing proposal context. `EmotionCheckInRoute` uses the same canonical
  `/(user)/emotion` route and guarded origin; only the small return-context region
  is new. Do not create an alternate check-in component.
- `SupportPlanApi` needs additive native proposal/activation/read/occurrence and
  reconcile methods based on Care generated contracts. EmotionApi still owns
  check-in content and factual progress. Keep query keys subject-scoped.
- Prefer explicit router navigation to the typed origin after canonical save;
  `router.back()` alone cannot guarantee the same activity on direct launch or
  after a browser/session restoration. Safe fallback goes to the current plan.
- Mutation success invalidates the relevant factual owner query but never calls
  hidden completion. Exact return focuses/accessibility-announces the matching
  activity, then user chooses an explicit check. Source deletion does not remove
  previously accepted plan history.
- Read matching Expo57 docs before production Router/React Native API changes.
  Author Maestro: native action entry → canonical Emotion save → exact return →
  explicit check → reload accepted state; missing/deleted/outage scenarios.
  Runtime native execution remains NOT_RUN under MB-666, not a browser pass.

## Evidence boundary

The local prototype uses deliberately synthetic localStorage state in an isolated
static server only. It demonstrates interactions and route continuity, not real
owner APIs, admission, authentication, concurrency, database or native execution.
Production must use existing BFF/session and owner contracts instead of copying
prototype state or Stitch CDN/runtime.

Version-sensitive references checked for this mapping: installed Next16
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
[Expo57 SDK reference](https://docs.expo.dev/versions/v57.0.0/),
[Expo Router URL parameters](https://docs.expo.dev/router/reference/url-parameters/),
and [SDK57 safe-area context](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/).
This mapping was prepared before implementation. Production RN translation
after the explicit fallback approval is recorded below.

## RN source translation — 14 October 2026

Implemented `SupportPlanActionWorkspace` behind the existing authenticated
`SupportPlanRoute`. The owner representation keeps v2 plans on the existing
`SupportPlanScreen`; pending/failed terminal history never silently dispatches
legacy. Empty history uses explicit native proposal. Native proposal, draft
schedule, activation, governed replacement, lifecycle confirmation and paginated
terminal history consume Care's existing authenticated action API factory.

`EmotionCheckInRoute` resolves the exact owned occurrence/action/schedule before
opening the existing canonical form. It keys the form by subject/origin/day/zone,
ignores user-supplied date/zone query parameters and refuses alternate-day create.
The return carries only typed IDs. The same activity is scrolled into view with
no motion and receives the existing native accessibility focus pattern. Nothing
reconciles on mount, save, refocus or return. Only the explicit activity button
calls reconciliation; fresh source absence/deletion/outage remains distinct from
accepted history. Late commands retain their captured subject/day/zone and
cannot overwrite a subsequently opened form context. Retry reuses save identity.

Shared `Screen` gained only optional scroll/content refs; existing SafeArea,
single-scroll reading column, tokens, widths, navigation and typography stay
unchanged. No new app chrome or native font package was introduced.

Resource entry opens the existing canonical resource-detail route and carries
the activity date. That owner currently reads current published content, not a
frozen revision; this change does not claim historical revision playback or
invent a new Content API. Native device/accessibility execution remains NOT_RUN.

Verification:

- Focused 6 suites: 67/67 passed, including legacy schedule A/B retention and
  delayed old-day/old-subject save regressions.
- Full mobile lint and typecheck passed. Full Jest: 70 suites, 549/549 passed;
  existing asynchronous `act` warnings are visible, not suppressed as evidence.
- `npm run quality` stopped at formatting: 276 baseline files differ under
  Prettier. A read-only `prettier --check . --end-of-line auto` narrows this to
  three unchanged files (`docs/NATIVE_VERIFICATION.md`,
  `src/community/CommunityMedia.test.tsx`,
  `src/journal/JournalAnalysisPanel.test.tsx`). Thus 273 warnings are Windows
  checkout line endings; three are independent baseline formatting issues.
  `git diff --exit-code` confirms these samples and the three remaining files
  were not edited by this slice. No unrelated bulk rewrite/config change was
  made. All changed RN UI/helper/route/Maestro files pass scoped
  `prettier --check`.
- Android and iOS Metro/Hermes exports passed after a scoped process-spawn
  escalation; initial sandbox export failed with `spawn EPERM`. Exports are
  bundle evidence, not installation, device, provider or API integration proof.
- Current actual RN source via RN Web passed return-in-viewport, explicit check
  and retry assertions at 375×812 and 768×1024; no page errors or horizontal
  overflow. See `reference-qa/report.json` and `native-baseline-native-plan*.png`.
  System typography intentionally has zero brand webfont faces.
- Maestro happy/recovery sources authored under `mobile/.maestro/mb-641-*`.
  **NOT_RUN — MB-666**; approved disposable fixture required. No shared fixture,
  real check-in, credential, account, SQL or Docker mutation occurred.
- Premium static audit JSON: `reference-qa/rn-static-audit.json`. Strict mode
  reports one unchanged test-only JSX button (`src/auth/session-context.test.tsx`
  line 30); it has a real RN `onPress={() => void signOut()}` handler that the
  browser-oriented lexical scanner does not recognize. No production finding
  was returned. This is a
  reviewed static false positive, not a clean strict-audit exit or runtime proof.

### Authorized baseline formatting follow-up

The user subsequently approved cleanup before Docker rebuild. Existing Prettier
normalized checkout CRLF to LF and formatted only the three substantive baseline
targets listed above, without weakening `endOfLine` or changing configuration.
`git diff --name-only -- mobile` now adds exactly those three paths to the eight
pre-existing tracked application changes; all other checkout touches are
line-ending-only and produce no Git content diff. The two test files retain
identical non-whitespace text; the documentation change only aligns its Markdown
table. Representative api-error/package/legacy-test files exactly match HEAD after
CRLF normalization.

`npm run format:check` now passes. Scoped ESLint and non-emitting TypeScript pass;
the two reformatted suites pass 26/26 tests. The earlier 549-test run and Android/
iOS exports were not repeated for whitespace-only changes. Docker rebuild is
handled separately by the parent agent; no Git staging/commit/push was performed.

### Synced development-base verification

After the authorized fast-forward/stash restoration onto frontend base
`53b4829`, `npm ci --no-audit --no-fund` installed the incoming LiveKit lockfile
without changing package/index/plugin configuration. Non-emitting TypeScript
and scoped ESLint passed. Fifteen focused suites passed 148/148 tests across
Emotion canonical routing/state, native SupportPlan, Community boundaries and
the incoming video/appointment integration. Android and iOS Metro/Hermes exports
passed using the preserved upstream `index.js` entry (1860/1726 modules).

The restored checkout had 55 CRLF-only formatting warnings; a full read-only
`prettier --check . --end-of-line auto` passed before one LF normalization with
the existing config. Strict full `npm run format:check` then passed. No full
Jest repetition was needed for the same behavioral changes; native execution
remains NOT_RUN. Curated evidence paths and optional replay dependencies are
listed in `README.md`; report paths are portable, with raw retrieved HTML kept
unchanged. Git integration and Docker/PR actions remain parent-owned.
