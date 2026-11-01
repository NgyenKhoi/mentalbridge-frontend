# MB-654 mobile SupportPlan Companion UX brief

## User job and authority

- Help a signed-in user understand an already approved SupportPlan action and
  reach its owning mobile route without losing the plan context.
- The companion is a bounded presenter. Care remains authoritative for plan
  identity, action identity, explanation policy and every plan mutation.
- The mobile client may send only `supportPlanId`, `actionId` and the approved
  `TODAY` or `PLAN` surface. It never sends journal content, emotion values,
  free text, inferred wellbeing, or completion claims.
- All guidance is explicitly requested. No route entry, animation, focus event,
  timer or network recovery may call the provider automatically.

## Full-frame baseline and locked shell

- Existing product baseline: the current React Native
  `NativeSupportPlanScreen` in `src/support-plan/SupportPlanActionWorkspace.tsx`,
  verified against the established mobile SupportPlan full frame in Stitch:
  `projects/1256373820415012052/screens/1ad44f3e0aa44ffd83c825fb26a65204`.
- Release-hardened companion reference:
  `projects/1256373820415012052/screens/01398a785ec541f79d100fd89718a6ec`.
- Locked chrome: Expo Router stack, safe-area treatment, back control, page
  eyebrow/title/description, reading-column width, SupportPlan sections and
  existing plan action controls.
- Editable content slot: one in-flow companion card after the page introduction,
  source-adjacent explicit explanation controls, and an expanded mobile bottom
  sheet. The card and sheet must not cover plan actions.

## Mobile interaction decisions

- The in-flow shell shows identity, current bounded state and a named 48px
  control. Its decorative leaf uses a small native-driver opacity/translate
  loop only when system Reduce Motion is off and the companion is not muted,
  hidden or interrupted. A static leaf plus complete text is the equivalent.
- Mute and hide are runtime-session preferences scoped to the authenticated
  subject. They survive route navigation in the running app, are not written to
  durable device storage, and never suppress authoritative plan notices.
- Expanding opens a native bottom sheet with preset intents only: explain the
  selected action, suggest the next user-controlled step, or navigate to the
  action owner. There is no chat field or arbitrary prompt.
- Journal, Emotion, Resource, Specialist and Reassessment navigation uses the
  existing Expo Router destinations and preserves the source plan/action or
  occurrence parameters already owned by those flows.
- Unsaved schedule edits, in-flight plan work and confirmation UI interrupt the
  companion: animations stop, the sheet closes, explanation controls disable,
  and no companion announcement or request is made.
- Offline, timeout, provider-unavailable and malformed responses show a neutral
  local availability message. Existing plan data and action controls remain
  usable and unchanged.

## Accessibility, responsive and performance gate

- Reuse the mobile palette, typography and spacing tokens; all controls are at
  least 48px and have Vietnamese accessible names, roles and state values.
- The bottom sheet is an accessible modal, moves focus to its heading on open,
  restores focus to its trigger on close, and keeps the close control available.
- Dynamic response text wraps without horizontal overflow. Loading and response
  announcements are polite only after an explicit request and are suppressed
  while muted or interrupted.
- Use React Native `AccessibilityInfo.isReduceMotionEnabled()` and the
  `reduceMotionChanged` event. Use core `Animated` with `useNativeDriver: true`;
  add no runtime dependency and perform no animation-driven React rerenders.
- The feature stays in a dedicated `src/support-plan-companion/` folder. Native
  device frame-rate and memory evidence remains the MB-666 staging gate; this
  change records source/bundle evidence and authors, but does not claim to run,
  the Android Maestro journey.

Stitch copy and data are layout evidence only. Production renders only parsed
Care contracts and deterministic client copy that does not imply plan authority.
