# MB-591 specialist operational dashboard

## Delivered flow

- The specialist workspace loads the dashboard through the same-origin
  `GET /api/consultation/specialist/dashboard` BFF.
- The BFF requires the `SPECIALIST` role and forwards the access token only to
  Consultation's typed `GET /api/v1/specialist/dashboard` endpoint.
- The production dashboard renders authoritative confirmed-today, pending,
  next-appointment, availability, and action-required facts. The former demo
  rows and fabricated client/session details are no longer on this route.
- Runtime validation is exact-key and fail-closed, so unexpected client,
  health, journal, assessment, chat, or note fields are not forwarded to the
  browser.

## UI state contract

| State                                       | User experience                                                |
| ------------------------------------------- | -------------------------------------------------------------- |
| Loading                                     | Accessible skeleton status without placeholder facts           |
| Ready/data                                  | Counts, next appointment, action links, source, and as-of time |
| Ready/empty                                 | Explicit zero/empty copy and only server-authorized actions    |
| Profile required/pending/rejected/suspended | Workload hidden; profile action shown                          |
| Dependency unavailable/malformed            | Error panel with retry; no cached demo fallback                |

The layout collapses to one column below 860 px, keeps interactive targets
keyboard-focusable, and disables skeleton animation for reduced-motion users.

## Verification

- Runtime contract parser covers valid bounded data, rejected unexpected
  client data, and profile fail-closed behavior.
- BFF test covers the specialist-authenticated server boundary.
- Component tests cover ready facts, suspended-profile blocking, dependency
  failure, and retry.
- Consultation provider/client contract snapshots are synchronized and checked.
