# MB-661 — Private achievement collection

## Journey

- Actor: authenticated `USER`.
- Route: `/achievements` inside the existing MentalBridge dashboard shell.
- Job: privately review factual first steps and bounded consistency milestones,
  choose whether the collection is visible, and understand when a source cannot
  currently be verified.
- Privacy promise: private by default; no leaderboard, comparison, treatment
  score, recovery claim, or reward for a negative emotion.

## Authority and scope

- Journal and emotion facts come from the Journal owner projection: first saved
  occurrence, distinct days, and server-calculated 3/7-day streak milestones.
- Resource facts come from Content's owner progress records joined to the exact
  reviewed publication snapshot.
- Journey milestones remain `DEFERRED` until MB-636 and MB-639 provide an
  explicit owner-confirmation source. Inactivity is never treated as evidence.
- Native mobile consumption and evidence remain in MB-665 and MB-666. This task
  provides the responsive web experience and shared API contract.

## Fixed UI states

| State                        | Rendering                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Loading                      | Calm skeleton; no cached personal facts shown as current                                                         |
| Loaded                       | Domain sections with earned, unearned, and deferred cards                                                        |
| New owner                    | All eligible cards are unearned with bounded zero progress                                                       |
| Partial source outage        | Available domains stay visible; unavailable domain cards explicitly say they cannot be verified and expose retry |
| Full failure                 | No old collection is shown; retry action is available                                                            |
| Hidden                       | Collection contents are removed from view; restore action remains                                                |
| Concurrent preference update | Refresh latest preference and explain the conflict                                                               |
| Grandfathered                | Kept award is labeled as preserved under its frozen earlier rule                                                 |

## Visual direction

- Reuse the production dashboard chrome and the Calm Garden language: warm
  paper background, sage surfaces, rounded cards, restrained shadows, botanical
  line details.
- Production typography is `Fraunces` for display and `Be Vietnam Pro` for UI
  and body copy, both loaded with the Vietnamese subset.
- All controls have at least a 44px target; status meaning is expressed in text
  as well as color.
- Layout: three columns at wide desktop, two around tablet, one on mobile; no
  horizontal scrolling at 1440, 1280, 768, or 375px.
- Motion is limited to small hover/press feedback and disabled under
  `prefers-reduced-motion: reduce`.

## Stitch evidence

- Project: `projects/15387448298495720355`
- Design system: `assets/9db26b360f6648d1a4579ae49ceca95e`
- Desktop screen: `be5530bc6d464d8499b82e6d0a3aeab5`
- Mobile screen: `16b500a2af0945b59881ce8df46eec7a`
- Stitch references use Newsreader for display; implementation maps it to the
  established production Fraunces token and keeps Be Vietnam Pro for Vietnamese
  copy.

The generated Stitch HTML is a static visual reference. `prototype.html`
provides a local full-shell interaction check for visibility and unavailable
source recovery before production implementation.
