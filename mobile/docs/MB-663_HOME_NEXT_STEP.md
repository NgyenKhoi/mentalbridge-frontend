# MB-663 USER Home next-step hub

## Delivery brief

- Actor and route: authenticated `USER`, `/(user)/user`.
- Job: understand one truthful next step without choosing from an undifferentiated feature wall.
- Authority: `GET /api/v1/home-next-step`; mobile presents its ordered journey action, plan focus, minimized progress, and next occurrence without ranking or clinical inference.
- Existing-UI fallback: preserve the Expo stack, `Screen` reading column, global crisis-support widget, tokens, and existing feature routes. No Stitch-fidelity reference was requested.
- Editable boundary: `UserHomeRoute`, `UserHomeScreen`, and the Home-only adapter/model. Shared navigation and feature modules remain unchanged.
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

- The strict Zod adapter accepts only the versioned Home response and rejects extra/private fields, mismatched plan IDs, impossible progress, and inconsistent occurrence focus.
- Emotion and Journal receive only their existing typed origin identifiers. Professional support receives only the action ID already supported by discovery.
- Home does not have a Content resource ID. Resource actions therefore open the exact plan occurrence; Support Plan resolves its authoritative Content source before entering Resource detail.
- `useFocusEffect` refetches after re-entry, so returning from an owner module reconciles persisted state instead of assuming success locally.
- The existing root `CrisisSupportWidget` remains independently available in every Home state.

## Verification status

- Component and contract tests cover first use, FREE/unavailable entitlement, active Journal and Resource routing, paused re-entry refresh, invalid payloads, and recoverable errors.
- Android Maestro source: `.maestro/mb-663-home-next-step.yaml`.
- Android execution and native screenshot: `NOT_RUN — staging milestone` per MB-605/MB-666 policy. The staging script writes a sanitized screenshot and manifest when the protected fixture is executed.
