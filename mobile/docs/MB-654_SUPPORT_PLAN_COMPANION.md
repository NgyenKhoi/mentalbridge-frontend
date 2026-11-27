# MB-654 mobile SupportPlan Companion

## Delivered boundary

The React Native SupportPlan route now presents the same bounded Companion
contract as web without adding mobile authority:

- The only provider-backed command is
  `POST /api/v2/support-plans/{supportPlanId}/actions/{actionId}/companion-explanation`
  with the exact body `{ "surface": "TODAY" | "PLAN" }`.
- A strict Zod parser checks every response key, owner identity, surface,
  schema/policy/prompt/template version, delivery attribution and the 480
  character limit. Unknown fields, mismatched identities and malformed
  generated/template attribution fail closed.
- There is no free-text prompt, automatic provider request, emotion inference,
  Journal content, completion assertion or plan mutation in the feature.
- `SUGGEST_NEXT_STEP` and `NAVIGATE` stay deterministic presentation intents.
  The server-backed intent remains `EXPLAIN_ACTION` only.

## Native presentation and session behavior

The feature lives in `src/support-plan-companion/` and is rendered in normal
SupportPlan document flow. It cannot cover the current plan, occurrence,
schedule or lifecycle actions. Expanded guidance uses a native modal bottom
sheet with preset controls only.

- System Reduce Motion is read with React Native `AccessibilityInfo` and
  observed with `reduceMotionChanged`. The decorative leaf becomes static.
- The small decorative loop uses core `Animated` with `useNativeDriver: true`
  and `isInteraction: false`; it is stopped while hidden, muted, interrupted or
  reduced-motion is enabled.
- Mute and collapse are in-memory, subject-scoped runtime-session preferences.
  They survive SupportPlan route navigation in the running process but are not
  persisted to device storage. Mute suppresses only Companion live-region
  announcements.
- Unsaved schedule changes, plan commands and confirmation UI close/disable
  guidance and invalidate an in-flight response. Authoritative plan controls
  and notices are unaffected.
- Offline, timeout, unavailable and malformed outcomes show neutral local copy.
  The already-loaded plan remains the sole authority and stays usable.

## Route continuity

The bounded navigation intent reuses existing Expo Router owners:

| Action               | Destination                      | Preserved authority                        |
| -------------------- | -------------------------------- | ------------------------------------------ |
| Journal              | `/(user)/journal`                | occurrence, action and local date when due |
| Emotion              | `/(user)/emotion`                | occurrence and action identity             |
| Resource             | `/(user)/resources/[resourceId]` | Content source identity and due date       |
| Professional support | `/(user)/specialists`            | plan action identity                       |
| Reassessment         | `/(user)/assessment`             | existing authenticated assessment route    |

Opening a destination never records completion. The existing owner flow must
still reconcile or mutate its own state explicitly.

## Web/mobile presentation differences

The contract, authority, fallback labels, explicit-request rule and zero
automatic prompt frequency match web. Presentation differs only where native
platform behavior requires it: mobile uses an in-flow card plus a native bottom
sheet, runtime-memory preferences instead of browser `sessionStorage`, React
Native accessibility focus events, and Expo Router destinations.

The UX brief and interactive local prototype are under `.stitch/MB-654/`.
Stitch generation rejected the detailed project prompt at its disclosure gate,
so implementation uses the already approved SupportPlan mobile baseline
`1ad44f3e0aa44ffd83c825fb26a65204` and release-hardened Companion reference
`01398a785ec541f79d100fd89718a6ec` from project `1256373820415012052`.

## Verification and performance evidence

Focused Jest covers strict transport parsing, identity mismatch, no automatic
request, duplicate request suppression, provider failure, interruption,
runtime preferences, all owner-route mappings and no navigation-based
completion. Full mobile verification is:

```powershell
npm run quality
```

No runtime package was added. The character animation updates opacity and
transform on the native driver without animation-frame React state updates.
Bundle export is recorded by `npm run quality`; native frame-rate, memory,
screen-reader and physical-device evidence remains the MB-666 staging gate.

## Android journey status

`E2E_AUTHORED_NOT_RUN`

`.maestro/mb-654-support-plan-companion.yaml` is authored for review on `dev`.
It is intentionally not claimed as execution evidence before MB-666 provides
the protected resettable Android environment.
