# MB-384 LiveKit video consultation — Stitch UX brief

## Authority and scope

1:1 appointment video only. Existing appointment contracts supply actor access,
schedule, status and credit truth. No client scoring, settlement, diagnosis,
recording, transcription, AI, screen share or group meetings.
Specialist confirmation is separate from leave/disconnect. Pending verification
keeps the consultation credit reserved; neither a timer nor media connection
proves completion. Automatic 24-hour settlement is not approved.

## Verified full-frame web baseline

- Project: MentalBridge UI Redesign `10509806209320093143`.
- Source screen `16211750247226508937`, 1440 × 972, retained as
  `baseline-specialist-appointments.png` (imported actual route screenshot).
- Verified against `components/RoleWorkspace.tsx`,
  `SpecialistWorkspaceNavigation.module.css` and
  `features/appointments/components/SpecialistAppointmentDecisionPanel.tsx`:
  role-sidebar, brand, role topbar, section heading, next appointment and filter
  controls are the current owning shell. Reuse them, never copy generated chrome.
- Locked: sidebar/role switcher, topbar, route title/context, appointments filter
  row, content bounds and page scroll. Editable: the selected IN_APP_VIDEO
  appointment's content subtree below its schedule/brief context. A call view may
  expand inside that subtree, not create a second page header/navigation.
- Existing chat full-frame captures are retained only for contextual comparison,
  not authorization to redesign Messages or put video into chat.
- USER actual route captures: `baseline-user-appointment-1440.png` and
  `baseline-user-appointment-375.png`, from `/appointments/{id}` with controlled
  fixtures. AuthenticatedShell/route heading/appointment facts/Brief stay locked.
- Native full-frame artifacts: `baseline-native-user-375.png` and
  `baseline-native-specialist-375.png`, rendering the complete existing route
  screens through RN Web (not a feature crop). Verified against Screen.tsx and
  both Expo Router layouts: native stack headers are disabled, Screen owns the
  safe area, scroll and reading bounds, and each route owns its back/title/context.
  Browser navigation is not copied into RN. These are visual proxies, not Android
  runtime or real-contract evidence.

## UX/state map

Appointment → prepare devices locally → explicitly join → call → leave →
appointment/brief/summary. Assigned Specialist separately confirms session end.

| State | Primary action / truthful feedback |
| --- | --- |
| Loading | Stable call surface; Đang kiểm tra quyền vào phiên… |
| Too early | Return to schedule; no connection or attendance |
| Waiting (-5m) | Kiểm tra camera và micro locally; no provider connection |
| Ready, active window | Tham gia phiên; freshly authorize access |
| First participant alone | Đang chờ người còn lại; no completion claim |
| Connected | Clearly labelled microphone/camera toggles and Rời cuộc gọi |
| Permission denied/device missing | Explain settings/device recovery; camera-off choice where feasible |
| Reconnecting | Persistent status, safe leave; do not extend appointment |
| Expired/unauthorized/cancelled | Stop media; return to eligible appointment context |
| Provider unavailable | Retry in place; manual brief/summary stay usable |
| Specialist end confirmation | Confirm dialog, explain ending both connections, not guaranteed settlement |
| Pending/review | Đang xác minh phiên; lượt tư vấn vẫn được giữ; no success invention |
| Verified completion | Show only authoritative backend result; summary remains accessible |

## Rendering and interaction gates

Fraunces headings and Be Vietnam Pro body/controls with Vietnamese subsets and
safe serif/sans-serif fallbacks match current web tokens. Avoid Material icon
ligature rendering errors: use explicit inline SVG controls with visible labels.
Native preserves existing system font/tokens unless separately approved.
Test stacked diacritics (ẩ, ễ, ặ, ỗ), realistic long text, 44px targets, visible
focus, disabled/loading/toggle states and readable contrast. Do not crop video
controls or put a floating bar over content. Live status uses text plus icons.

One primary action per decision region, no ornamental hero/KPI/clinical badge.
Keyboard order matches DOM; dialogs restore focus. Short 120–300ms state fades
only, no layout-replaying animation; reduced motion renders state immediately.
Desktop gates 1440×900, 1280×800; responsive 768/375/320 and 200% zoom.
Download and inspect Stitch screenshot + HTML, then exercise a shell-integrated
local interactive prototype before writing production UI. Synthetic examples
are prototype-only, never production appointment data or live-test evidence.

## Accepted references and fallback record

Stitch screens `2952a8bc402e49fa86261d02dee6926e` (desktop) and
`ee20c560cccc4a67914c94f6e7cc244b` (browser mobile) in the project above are retained
as `video-desktop-device-ux-stitch.*` / `video-browser-mobile-device-ux-stitch.*`.
The last corrective Stitch edit timed out after 300 seconds; three subsequent
screen polls returned the unchanged originals. Local prototype corrections are
explicitly **not** presented as Stitch-generated output: plain-language copy,
16px explanations, working camera-off recovery, safe Cancel initial focus, and
whole-background inert/focus restoration.

The user approved composing the existing Stitch panel into the actual USER/native
shell if browser import was unavailable. Browser inventory returned no enabled
surfaces; connector has no image-upload tool. This fallback was used, without
changing the application chrome or generating another shell.

Local interactive references: `video-specialist-desktop-prototype.html` and
`video-specialist-mobile-prototype.html`. Playwright: **13 passed**, widths
320/375/768/1280/1440, loaded fonts, Vietnamese diacritics, overflow/touch targets,
join/wait/toggles/reconnect/errors, safe destructive dialog focus/restoration,
pending verification and reduced motion. External font/CDN access is required
only for these reference prototypes; production uses existing bundled font tokens.

USER composites `prototype-user-appointment-{1440,375}.png` retain the actual
Next.js route and pass join/wait/leave, USER cannot see Specialist completion,
and no horizontal overflow. Native composites `prototype-native-{user,specialist}-375.png`
retain each complete existing route, pass join/camera-off/leave without render
exceptions or overflow. Run `capture-user-baseline.mjs --prototype` and
`capture-native-frame.mjs` with their local servers; inspect the captured images.
The native directory is a visual-only fixture harness; it does not alter app auth,
navigation or production APIs. All examples/evidence use synthetic appointments.
