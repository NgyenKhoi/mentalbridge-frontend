# MB-642 native Stitch Instant Prototype

Status: **CREATED_BY_USER / PLAY_NOT_VERIFIED**. User supplied the native
prototype link, and get_screen/get_project verify its node title and existence:
[MentalBridge Support Plan & Journal Flow](https://stitch.withgoogle.com/projects/1256373820415012052?node-id=678423c41ebc47d49538c0d6b85ebe38).
The retrieved export is `native-instant-prototype.html`; it appears to flatten the
starting frame and is not proof of the native play runtime or screen connections.
This document remains a setup/checklist, not a prototype itself.

Project: [MB-637 — Support Plan v3 UX Prototype](https://stitch.withgoogle.com/projects/1256373820415012052).
Use the final corrected MB-642 screen set after the render/source review. Do not
select old MB-641 or initial rejected MB-642 screens. Keep desktop and mobile
flows separate so route transitions do not unexpectedly change viewport.

## Required screen set

| State                                      | Desktop | Mobile |
| ------------------------------------------ | ------- | ------ |
| Scheduled Journal activity                 | D01     | M01    |
| Existing Journal new-entry editor          | D02     | M02    |
| Save failed, fields preserved              | D03     | M03    |
| Saved entry, explicit return decision      | D04     | M04    |
| Exact returned activity, not yet completed | D05     | M05    |
| Owner-backed accepted completion           | D06     | M06    |
| Completion check unavailable               | D07     | M07    |
| Leave-with-draft confirmation              | D08     | M08    |

The user has performed **Generate → Instant Prototype**. Its node was subsequently
visible in the project catalogue. Earlier temporary omissions from that catalogue
were not evidence of failed creation. Native screen connections and playback
still require an authenticated play review; exported frames do not prove them.

The connector does not currently expose native connection/play inspection,
and no authenticated browser-control session is available. Native creation is
confirmed; a fresh unauthenticated browser could not access play. The user
approved a source-shell supplemental local QA fallback on 2026-10-14. Do not access personal
browser cookies or undocumented private endpoints to bypass this limitation.

## Required connections and state behavior

- 01 “Viết nhật ký” → 02, showing correct owned activity context.
- 02 save → actual pending, then 04; explicit failure scenario → 03. Preserve
  selected mood/text/date/tags through failure and retry; do not reset the editor.
- 03 retry → pending → 04. Staying editable must retain the same text/selection.
- 04 “Quay lại hoạt động” → 05, focused on exact activity, still NOT completed.
- 05 explicit check → pending → 06; failure scenario → 07. No automatic check on
  route entry, save, reload or rendering; no successful animation before result.
- 07 retry → pending → 06, with saved candidate preserved.
- 02 close/return with unsaved changes → 08; stay/Escape → 02 preserving fields;
  explicit discard → 01. Do not claim persistent offline drafts.
- 06 view Journal → existing saved-entry view and back to same activity. Editing
  old content must not create another writing completion.
- Deleting the source after acceptance retains accepted history with explanatory
  source-state text. Deleting before acceptance cannot create completion.

All outcomes here use clear synthetic prototype fixtures, not live backend calls.
No entry text/mood/tags/AI content travels to the plan; candidate IDs alone are
not completion proof. Current authority remains with Journal/Care owner APIs.

## Play/review checks

1. Existing sidebar/topbar/route header/four plan tabs and canonical Journal
   controls remain; Journal editor is not drawn over a Plan page.
2. Keyboard and visible focus; accessible radio labels; Escape/stay/discard;
   focus returns correctly. Mobile Save/Return must not be covered by the widget.
3. 1440×900, 1280×800, 375×812, 768px, 640×400 zoom-equivalent; no horizontal
   overflow or unreachable footer, including long Vietnamese.
4. Loaded Fraunces/Be Vietnam Pro with correct Vietnamese, icons and contrast.
5. Reduced motion keeps feedback and operation immediate; no API waits for motion.
6. Ordinary Journal works without plan context; invalid/stale/inactive/future or
   wrong-day context has honest recovery, no backdating or fake completion.
7. Save/check retry, same candidate, independent dirty action drafts survive.

Record real native prototype link/ID and observed click-through results when
available. A black thumbnail, linked screenshots alone or a screen title is not
evidence that the behavior above has been exercised.
