# MB-642 current-route baseline

This evidence-only checkout contains the report and four selected viewport
frames (desktop/mobile SupportPlan and Journal create). The full twelve-frame
capture, script, flattened HTML and captured assets remain workspace-local.
The historical command below requires that complete workspace bundle; it is
not a runnable command from this curated directory alone.

Capture command:

```powershell
node --experimental-strip-types .stitch/mb-642/capture-baseline.mjs
```

This is **static baseline evidence, not a prototype**. The existing production
standalone build `ho8DH5hX7WZabEAeCkmbt` renders the current MB-641 UI; unbuilt
MB-642 transport changes are not claimed as runtime evidence here.

The 12 captures cover `/support-plan` native workspace, `/journal` empty page,
and the existing canonical Journal create dialog at 1440×900, 1280×800,
375×812, and 768×1024. `*.viewport.png` records the exact viewport; `*.png`
records the full page. `*.html` has scripts removed and local styles/fonts
under `_next/static/`; it must not be presented as an interactive flow.

The script uses separate loopback fixtures on 3311/3312 and frontend 3112,
fails when those ports are occupied or standalone contains `.env` files,
inherits only innocuous OS variables, and sends the synthetic session only to
the isolated frontend. All service URLs are loopback; browser API payloads
are controlled, external browser requests are blocked. It neither loads `.env`
nor contacts the shared dev database/services.

`report.json` records exact build/source metadata, content widths, tabs,
font-face load status, errors, overflow, and downloaded assets. All 12 capture
states had no horizontal page overflow, no page errors, and no external browser
requests. The applicable Fraunces and Be Vietnam Pro faces loaded; declared
unused subset/weight faces can remain unloaded. Thirty-eight CSS/font/static
assets were saved without download failures. No native-device or performance
claim follows from this reduced-motion browser capture.

Verified locked chrome: existing sidebar/mobile shell, global top bar,
route title/context, content width/scroll ownership; native SupportPlan retains
the four tabs Hôm nay / Kế hoạch / Tiến triển / Điều chỉnh. The added JOURNAL
fixture shows the current rendering limitation (no writing handoff CTA), not
implemented MB-642 behavior.

Visible baseline issues to account for in the UX gate:

- On 375px Journal create, initial textarea focus scrolls the dialog body;
  the mood/date controls are above the visible scroll position.
- The pre-existing floating safety widget overlaps the right edge of the
  create-dialog footer / disabled Save control at 375px. The MB-642 design
  must keep its new primary/return actions and focus targets clear of it.
- Full-page screenshots extend beyond the fixed dialog/backdrop viewport;
  use the viewport companions when reviewing the initial interactive frame.

No production source was changed for this capture. Native Stitch Instant
Prototype generation and interaction QA remain separate required gates.
