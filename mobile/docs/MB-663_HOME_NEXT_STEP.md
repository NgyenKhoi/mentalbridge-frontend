# MB-663 USER Home next-step hub

## Delivery brief

- Actor and route: authenticated `USER`, `/(user)/user`.
- Job: understand one truthful next step without choosing from an undifferentiated feature wall.
- Authority: `GET /api/v1/home-next-step`; mobile presents its ordered journey action, plan focus, minimized progress, and next occurrence without ranking or clinical inference.
- Existing-UI fallback: preserve the Expo stack, `Screen` reading column, global crisis-support widget, tokens, and existing feature routes. No Stitch-fidelity reference was requested.
- Editable boundary: `UserHomeRoute`, `UserHomeScreen`, the Home adapter/model, and the typed SupportPlan Home-entry resolver. The existing SupportPlan UI and lifecycle commands remain unchanged.
- Responsive/touch: one reading column up to 560 px, scroll-owned by `Screen`, 48 px actions, collapsed secondary destinations, no motion beyond existing pressed feedback.

## Low-fidelity information architecture

```text
Global crisis support (always available above the route stack)

Hôm nay của bạn
└─ Authoritative next-step panel
   ├─ state label
   ├─ one heading and plain-language reason
   ├─ optional factual completed count
   ├─ one primary action
   └─ optional saved-guide link

Các khu vực khác (collapsed by default)
└─ notifications / reminders / messages / appointments / specialists /
   community / journal / emotion / profile

Đăng xuất
```

## Acceptance-state matrix

| Authoritative state                          | Home shows                                               | Primary destination                                | Home must not show                               |
| -------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| First use / initial check in progress        | Start or continue the initial screening                  | Assessment                                         | Diagnosis, guessed priority, feature wall        |
| Saved Guide, FREE or entitlement unavailable | Useful reviewed-resource path and saved-guide access     | Resources                                          | Upgrade blocker or fabricated paid entitlement   |
| Safety or professional-support priority      | Server-ordered support or specialist step                | Assessment safety guidance or specialist discovery | Mobile score/risk inference                      |
| Draft / proposal eligible                    | Review-before-activation language                        | Support Plan                                       | Automatic activation                             |
| ACTIVE, due Emotion or Journal action        | Exact title, optional duration, factual completion count | Typed owner route with occurrence/action context   | Raw emotion/journal data or automatic completion |
| ACTIVE, due Resource/routine/review action   | Exact title, optional duration, anchored plan activity   | Support Plan activity                              | Guessed Content ID or completion claim           |
| PAUSED                                       | Neutral resume invitation                                | Support Plan                                       | Missed-day pressure                              |
| Review due                                   | User-controlled review invitation                        | Support Plan                                       | Automatic lifecycle change                       |
| Today done / nothing today                   | No remaining work or no scheduled work                   | Progress/plan                                      | Streak, recovery score, pressure to open the app |
| Completed plan, no current plan              | Continue with saved Guide/resources                      | Resources                                          | Invented future plan                             |
| Source unavailable / invalid response        | Honest retained-state message, retry, FREE resources     | Retry or Resources                                 | Fabricated cached decision or completion         |

## Contract and return behavior

- The strict Zod adapter accepts only the versioned Home response, rejects extra/private fields, impossible progress, and inconsistent occurrence focus, and checks matching plan IDs only when the journey action is `OPEN_CURRENT_PLAN`. Safety and professional-support actions may validly coexist with persisted plan context and remain primary.
- Emotion and Journal receive only their existing typed origin identifiers. Professional support receives only the action ID already supported by discovery.
- Home does not have a Content resource ID. Resource, routine, and review actions therefore carry a typed `source=home` origin with occurrence, action type, action identity, and local date. SupportPlan verifies those hints against the owner plan action plus occurrence before focusing the exact activity; non-UUID v2 slot identities remain supported. Resource detail opens only after the owner action supplies its authoritative Content source.
- A changed or invalid Home origin keeps the current plan visible, performs no mutation, and offers an explicit activity reload.
- `useFocusEffect` refetches after re-entry, so returning from an owner module reconciles persisted state instead of assuming success locally.
- The existing root `CrisisSupportWidget` remains independently available in every Home state.

## Verification status

- Contract/model/component tests cover first use, FREE/unavailable entitlement, safety/professional precedence with an owner plan, typed Resource/routine/review entry, native and v2 owner resolution, changed-origin recovery, and refreshed Home state after re-entry.
- Navigation-only Android source: `.maestro/mb-663-home-next-step.yaml`.
- Persisted reconciliation Android source: `.maestro/mb-663-home-reconciliation.yaml`; it completes the seeded owner Resource occurrence and requires a different server-backed Home title after returning.
- `scripts/verify-android-home-e2e.sh` runs both flows and requires resettable protected fixture values for the before and after decisions.
- PR #240 owns the mandatory build-once Android milestone. This branch intentionally does not modify its older skipped workflow or shared native-verification files. After #240 merges, rebase MB-663 and add the Home runner as a phase in `run-staging-android-milestone.sh` before requesting native evidence.
- Android execution and native screenshot: `NOT_RUN — staging milestone`. Authored Maestro source and a disabled legacy job are not Android PASS evidence.
