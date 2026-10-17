# MB-642 corrected desktop artifact QA — NOT ACCEPTED

Read-only artifact review, 2026-10-14. This is not a review or pass of the user's
native Instant Prototype node `678423c41ebc47d49538c0d6b85ebe38`.

## Evidence

- Retrieved all five corrected screens from maintained project1256373820415012052.
  Exact IDs, titles and downloaded raw paths: `corrected-desktop-manifest.json`.
- Saved raw HTML/PNG separately as `screens/corrected-desktop-01..05.*`; initial
  generation artifacts and original manifest remain intact.
- Ran `node .stitch/mb-642/review-corrected-desktop.mjs` using a new credential-free
  headless Chrome context for each of1440×900 and1280×800, reduced motion enabled.
  Initial sandbox spawnEPERM was corrected using approved subprocess escalation.
  Only local artifact origin, Google Fonts and Tailwind CDN GET were permitted;
  no personal browser profile, real session, API or shared service was used.
- Actual renders/report: `reference-qa/corrected-desktop/`. Loaded Fraunces and
  Be Vietnam Pro three faces each in all ten renders; no page errors. All1440px
  frames avoid horizontal overflow. D01 overflows at1280; the other four do not.
- Visually compared actual corrected renders with real-route baselines
  `baseline/{support-plan,journal,journal-create}-desktop.viewport.png` and current
  `NativeSupportPlanJourney.tsx`/canonical Journal page ownership.

## Material defects remaining

1. **D01 still moves locked route composition.** It wraps route heading and four
   tabs inside a new rounded white parent starting aroundy104. Baseline heading
   and tabs are outside the white Today panel, which begins aty346. H1 is reduced
   from52px to34px; tabs are grouped left rather than distributed across their
   equal-width source columns. The activity-day picker is removed. D05 restores
   a separate parent but still shrinks/repositions heading/tabs (Todayy287), so
   D01→D05 changes unrelated composition during a simple return transition.
2. **D01 laptop content is clipped.** `.app-viewport { min-width:1440px }` produces
   confirmed horizontal page overflow at1280×800; right column/header controls
   leave the viewport. Source baseline adapts to1280.
3. **D02/D03 redesign the canonical editor and its error state.** The existing
   writing-prompt panel, Now control, tag input/presets, required mood/content and
   canonical fields are not retained. D02 mood order/labels differ fromD03; error
   frame substitutes “Rất tệ/Nặng nề/Bình thường/Tốt/Rất nhẹ” for existing options.
   Same text/date/tags are visually retained, but changing choices/layout during
   save failure violates the unchanged-editor requirement and state continuity.
4. **D02 still invents automatic draft persistence.** Visible “Đã tự động lưu nháp”
   remains atHTMLline427. Current editor only retains the draft in session memory;
   the design must not imply a saved/offline draft. D03's memory-only error copy
   is improved and does not repairD02's incorrect assurance.
5. **D04 replaces the Journal page and invents assertions/content.** Source hero,
   summary/filter/calendar composition is replaced by timeline plus new sidecards.
   “Không gian an toàn tuyệt đối” is an unsupported absolute claim. “5 phút suy
   ngẫm” is inferred as actual time; extra breathing/chest-pressure paragraph was
   not entered inD02/D03. These are outside the bounded origin/save/return slot.
6. **Global chrome remains changed across frames.** Despite correct nominal232px
   sidebar/72px topbar, font density, icons, avatar treatment, search width and
   sidebar groups vary from source and between corrected frames. D04 even moves
   Achievements into the first group. Do not copy this chrome into production.

## Improvements / limits

- Wednesday14/10/2026 and both actual rhythm rows are now consistent.
- Exact returned-entry check wording inD05 is corrected; no “latest entry” lookup
  assertion remains there. Return remains explicitly unaccepted until check.
- Vietnamese glyphs visually render correctly; no raw private owner field names
  appear in the reviewed visible copy.
- Primary save/retry/check controls render at44px. Some close/tag/edit targets
  remain smaller. Static HTML has no complete save/check/draft-guard state machine,
  no proven dialog focus trap/restore and no reduced-motion override for its hover
  transforms. These cannot prove native prototype behavior in either direction.

Conclusion: corrected desktop design gate still **FAIL / NOT_ACCEPTED**. A native
prototype may exist because the user created it, but its click-through, mobile,
keyboard, pending/failure and recovery behavior remain separately **NOT_REVIEWED**
by this artifact-only task. No production, Git, Jira or Stitch generation writes.
