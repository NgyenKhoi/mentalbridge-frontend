# Synthetic browser evidence

MB-767 adds the lazy-loaded Mầm renderer with a static fallback. Real-runtime,
no-splash, origin and fallback results are in
[`mb-767-mam-rive-renderer.md`](mb-767-mam-rive-renderer.md).

MB-766 verifies and freezes the Mầm v0.3 Rive asset (hash, controls, sizes,
gaze, hero bounds, reduced-motion and visibility guards, contrast). Results
and captures are in [`mb-766-mam-rive-contract.md`](mb-766-mam-rive-contract.md).

MB-652 explains Care's adaptive SupportPlan replacement review inside the
bounded Companion while keeping every evidence dimension separate and all plan
mutation in the normal Adjust UI. Its contradictory, sparse, unchanged,
alternative, current-not-admissible, dependency-independent, desktop/mobile,
and no-mutation evidence is recorded in
[`mb-652-adaptive-review-companion.md`](mb-652-adaptive-review-companion.md).

MB-648 adds the bounded, presentation-only SupportPlan Companion shell. Its
state-machine, isolation, fallback, accessibility, responsive, performance, and
Stitch evidence is recorded in
[`mb-648-support-plan-companion-shell.md`](mb-648-support-plan-companion-shell.md),
with controlled desktop, mobile, and reduced-motion captures in this directory.

MB-660 persists owner-scoped resource bookmarks and optional weekly Bingo with
separate self-confirmed and Content-verified evidence. Its contract, conflict,
reload/delete, typography, responsive, and fixture-browser verification is
recorded in [`mb-660-persistent-resource-engagement.md`](mb-660-persistent-resource-engagement.md),
with controlled desktop and mobile captures in this directory.

MB-620 closes the Specialist Portal production surface around owner-backed
capabilities and truthful deferred states. Unit, route-composition, responsive,
and fixture-browser coverage is recorded in
[`../mb-620-specialist-portal-closure-evidence.md`](../mb-620-specialist-portal-closure-evidence.md),
with controlled desktop, laptop, and mobile captures in this directory.

MB-616 adds a private, server-owned Community saved-post collection. Its BFF,
component, reload, unbookmark, and fixture-browser evidence is recorded in
[`../mb-616-community-saved-posts-evidence.md`](../mb-616-community-saved-posts-evidence.md),
with the controlled synthetic capture `mb-616-community-saved-posts.png`.
The corresponding 375px capture is
`mb-616-community-saved-posts-mobile.png`.

MB-615 adds an explicit bounded Community sensitive-content warning and
reader-controlled disclosure. Contract, accessibility, author/moderator, and
fixture-browser coverage is recorded in
[`../mb-615-community-sensitive-content-evidence.md`](../mb-615-community-sensitive-content-evidence.md),
with controlled concealed and revealed screenshots in this directory.

MB-614 adds one optional reviewed MentalBridge resource attachment to Community
posts. Its create/reload/navigation journey, unavailable state, owner edit and
contract privacy coverage are recorded in
[`mb-614-community-resource-attachment.md`](mb-614-community-resource-attachment.md),
with the synthetic capture `mb-614-community-resource-attachment.png`.

MB-549's persisted appointment-reminder preference, safe entry route, and
focused consumer checks are documented in
[`mb-549-appointment-reminder-consumer.md`](mb-549-appointment-reminder-consumer.md).

MB-380 produces `mb-380-appointment-changes.png` from the controlled
appointment cancellation journey. The same focused Playwright file verifies
that cancellation and replacement commands preserve the exact appointment
version and idempotency headers. Regenerate it with
`npm run test:e2e -- tests/e2e/appointment-changes.spec.ts` after
`npm run build`; the identities and appointment payloads are synthetic.

MB-567 adds authoritative emotion history, current/longest streaks, and factual
7/14/30-day coverage to the dashboard. Its BFF/component/fixture evidence is
recorded in
[`mb-567-emotion-progress.md`](mb-567-emotion-progress.md), with the synthetic
capture `mb-567-emotion-progress.png`.

MB-566 integrates the dashboard emotion picker with the persisted MB-510
daily check-in aggregate. Its contract, BFF, component, local-day and
fixture-browser coverage is recorded in
[`mb-566-persisted-dashboard-emotion-picker.md`](mb-566-persisted-dashboard-emotion-picker.md).

MB-657 makes that daily emotion record the source shown by Dashboard,
Resources, Journal and emotion history, and removes the unused fixed-sample
modal. Its controlled multi-route, deletion, responsive and legacy-audit
evidence is recorded in
[`mb-657-authoritative-daily-emotion.md`](mb-657-authoritative-daily-emotion.md).

MB-658 adds optional, encrypted influence factors and a private note to that
owner-controlled daily record. Its consent copy, privacy boundaries,
web/mobile contract coverage and responsive fixture-browser evidence are
recorded in
[`mb-658-optional-emotion-context.md`](mb-658-optional-emotion-context.md).

MB-650 adds explicit contextual Companion explanations to eligible SupportPlan
actions while keeping Care facts and original actions authoritative. Its
contract, fallback, desktop/mobile, typography and accessibility evidence is
recorded in
[`mb-650-contextual-companion.md`](mb-650-contextual-companion.md).

MB-651 adds the explicitly opened, bounded guided Companion panel with fixed
starters, session-memory retention, source labels, safe follow-up navigation,
and responsive sheet behavior. Its contract, privacy, Stitch, accessibility,
and regression evidence is recorded in
[`mb-651-expanded-guided-companion.md`](mb-651-expanded-guided-companion.md).

MB-653 hardens the SupportPlan Companion release gate with tab-session mute and
hide semantics, interruption controls, zero passive prompting, reduced-motion
equivalence, explicit source/runtime budgets, dependency-failure coverage, and
desktop/mobile accessibility evidence. Its compliance matrix and release
checklist are recorded in
[`mb-653-support-plan-companion-hardening.md`](mb-653-support-plan-companion-hardening.md).
MB-659 replaces presentation-only Resource rewards with a Content-authoritative,
versioned and hideable participation read model. Contract, BFF, component,
failure-recovery, accessibility and controlled browser evidence is recorded in
[`../mb-659-resource-reward-evidence.md`](../mb-659-resource-reward-evidence.md).

MB-563 delivers the server-backed notification inbox and lifecycle. Its
contract/BFF/component/fixture coverage is recorded in
[`mb-563-notification-inbox.md`](mb-563-notification-inbox.md).

This directory contains review evidence generated by controlled Playwright journeys. Evidence must use synthetic identities and assessment data only and must never contain bearer tokens, raw assessment answers, real personal data or external-provider payloads.

MB-205 produces `mb-205-progress-desktop.png` and `mb-205-progress-mobile.png` after the real Care Spring Boot/PostgreSQL comparison succeeds. Regenerate them with `npx playwright test tests/e2e/care-assessment.spec.ts --workers=1` after `npm run build`.

MB-236 produces `mb-236-journal-desktop.png` and
`mb-236-journal-mobile.png`. The provider verification uses a disposable
MongoDB database, while the screenshots contain only controlled synthetic
Journal content. Regenerate them with
`npx playwright test tests/e2e/journal.spec.ts --project=chromium` after
`npm run build`.

Story 6201 produces `story-6201-journal-desktop.png` and
`story-6201-journal-mobile.png`. The controlled `fixture-browser` journey
covers mood-aware create and reload, an ambiguous failed save with retained
draft, unsaved-close protection, revision-conflict recovery, edit, and delete
through the same-origin BFF. It also checks portrait and landscape overflow.
Regenerate the synthetic evidence with
`npx playwright test tests/e2e/journal.spec.ts --project=chromium` after
`npm run build`; do not label these artifacts as live cross-stack evidence.

MB-368 produces `mb-368-journal-ai-reflection.png`,
`mb-368-journal-ai-font-vietnamese.png`, and the Lora comparison capture
`mb-368-journal-ai-font-lora.png`. The controlled
`fixture-browser` journey proves explicit AI consent, exact-revision async job
polling, reload restoration, stale-result rejection, provider-failure retry,
allow-listed action routing, and consent revocation through the same-origin
BFF. It also verifies that the Journal modal and Reflection headings resolve to
Lora's Vietnamese subset instead of an unsupported serif fallback.
The fixture returns normalized synthetic analysis and is not live-provider or
live cross-stack evidence. Regenerate it with
`npm run test:e2e -- tests/e2e/journal.spec.ts` after `npm run build`.

MB-272 produces `mb-272-initial-check-questionnaire-desktop.png`,
`mb-272-initial-check-desktop.png` and `mb-272-initial-check-mobile.png` from
the guided dashboard-to-result journey.
The browser test also proves that optional-resource failure does not hide the
support evaluation's local safety guidance. Regenerate both images with the
same Care assessment Playwright command after a production build.

MB-273 produces `mb-273-fixture-result-desktop.png`,
`mb-273-fixture-result-mobile.png`, and the sanitized
`mb-273-fixture-persisted-evidence.json` from the explicitly classified
`fixture-browser` release-readiness journey. Regenerate them with
`npm run test:e2e:initial-check:fixture`. They are controlled local evidence,
not proof of a live cross-stack run. Every artifact must be labeled with its
evidence class, environment, and reviewed commit identifiers.

The service-integration run writes
`mb-273-service-persisted-evidence.json` and attaches desktop/mobile screenshots
to its Playwright report. Those artifacts prove real Care and disposable
PostgreSQL behavior while Identity and Content remain controlled fixtures; they
must not be labeled as live cross-stack evidence. Screenshots are not duplicated
in Git because the deterministic visual output matches the fixture images.
