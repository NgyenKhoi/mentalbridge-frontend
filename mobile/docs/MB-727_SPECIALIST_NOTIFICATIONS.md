# MB-727 — SPECIALIST notifications on mobile

## Scope and authority

The SPECIALIST workspace reuses the existing owner-scoped notification inbox,
read-state and preference APIs. The bearer session remains the only account
authority: list, mark-one, mark-all and preference requests contain no actor or
owner identifier. This slice adds no backend endpoint, local notification
storage, device-token registration, push provider or new domain state.

The implementation follows the approved existing-UI fallback. It reuses the
current full-screen mobile notification baseline from MB-632, existing MentalBridge
tokens and controls, and the installed SPECIALIST navigation tree. No Stitch
prototype or new visual language is introduced.

## UI brief and state matrix

- Role and route: SPECIALIST home → notifications → supported specialist
  destination, or notification preferences.
- Primary task: read owned operational updates, confirm read state, and open
  only an installed destination appropriate to the current SPECIALIST session.
- Authority: Content/Notification owns inbox, unread count, read mutations,
  preferences and preference version. Identity owns subject and role.
- Out of scope: USER wellbeing destinations and settings, arbitrary links,
  notification content as destination data, native push delivery and backend
  changes.

| State                    | Screen shows                                                      | Must not show or claim                             | Recovery / next action                            |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Initial loading          | Stable notification shell and loading status                      | Cached content from another subject or role        | Wait for the owner API                            |
| Unread data              | Owned rows and authoritative unread count                         | USER-only navigation or raw private payloads       | Mark one/all read or open a supported destination |
| Mark one/all confirmed   | State returned after the command and fresh inbox read             | Optimistic or false success after a failed command | Retry from the current authoritative inbox        |
| Empty / all read         | Truthful empty or zero-unread state                               | Invented specialist activity                       | Return to the specialist workspace or reload      |
| Expired auth / API error | Bounded error with the inbox content hidden during failed refresh | Another account's cached rows or backend details   | Restore the session or retry                      |
| Unsupported destination  | Inert row with an unavailable-link explanation                    | Arbitrary URL launch or fallback into a USER route | Continue in the inbox                             |
| Stale preference version | Current server preferences after reconciliation                   | Silent replay of an obsolete full replacement      | Review the refreshed values, then save again      |

## Bounded specialist navigation

The server-provided `href` is never passed directly to Expo Router. A
SPECIALIST session can resolve only these exact action descriptors:

| Action                         | Exact public href          | Installed mobile route       |
| ------------------------------ | -------------------------- | ---------------------------- |
| `OPEN_MESSAGES`                | `/messages`                | `/(specialist)/messages`     |
| `OPEN_SPECIALIST_APPOINTMENTS` | `/specialist/appointments` | `/(specialist)/appointments` |

Both actions require `targetId: null`. USER-only actions, targeted actions,
external/protocol-relative URLs, queries, fragments, encoded or traversal
variants, and mismatched action/path/ID combinations remain unavailable.

## Bounded specialist preferences

The preferences response is still parsed against the complete canonical
schema. The SPECIALIST editor exposes and writes only operational fields:

```text
notificationsEnabled
channels.inApp
contentGroups.appointmentMessage
contentGroups.resourceSystem
```

This mobile slice follows the existing specialist Web parity surface, so it
does not expose Journal, emotion check-in, streak, screening, Community,
quiet-hour, email or PUSH controls. The PATCH uses the exact strong `If-Match`
value returned with the owner preference record; conflict or ambiguous failure
reloads authority before another write.

## Verification and execution boundary

Focused development evidence is recorded against the final branch head with:

```powershell
npm run test:ci -- src/notifications src/screens/SpecialistHomeScreen.test.tsx
npx prettier --check "src/app/(specialist)/notifications.tsx" "src/app/(specialist)/notification-preferences.tsx" src/screens/SpecialistHomeScreen.tsx src/screens/SpecialistHomeScreen.test.tsx .maestro/mb-727-specialist-notifications.yaml docs/MB-727_SPECIALIST_NOTIFICATIONS.md
npm run lint
npm run typecheck
```

Executed in this worktree after assembling the complete feature diff:

- Focused notification and home Jest — **PASS**, 6 suites / 91 tests.
- Mobile ESLint — **PASS** with zero warnings.
- Strict non-emitting TypeScript — **PASS**.
- Targeted Prettier for every changed implementation, test, route, Maestro and
  evidence file — **PASS**.
- Full mobile Jest — **105 suites / 910 tests passed; 1 unrelated baseline
  test failed** in
  `src/support-plan-companion/SupportPlanCompanion.test.tsx` (expected two
  companion explanation calls, received one). MB-727 does not change that
  module; the focused notification suites remain green.

The authored Maestro source is
`.maestro/mb-727-specialist-notifications.yaml`. Android execution is
**NOT_RUN** until the MB-666 protected staging milestone provides the approved
device, authenticated SPECIALIST fixture and real-contract environment. No
device pass, screenshot or provider evidence is claimed by this development
branch.
