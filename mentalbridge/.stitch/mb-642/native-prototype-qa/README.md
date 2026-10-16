# MB-642 native Stitch prototype — access and export inspection

Checked on 2026-10-14 at 05:53 UTC with fresh headless Chrome, 1440×900,
reduced motion, no personal browser profile, cookies, sign-in or user actions.
The page's normal automatic initialization requests were allowed; only telemetry
was blocked. No private RPC was manually called and no Stitch content was changed.

User-supplied native node:
https://stitch.withgoogle.com/projects/1256373820415012052?node-id=678423c41ebc47d49538c0d6b85ebe38

## Remote result — access blocked, not a prototype failure

The top-level document returns HTTP 200. The actual Stitch app iframe displays
`Sign In`, `404`, and `This page doesn't exist or isn't shared with you.`
Screenshot: `fresh-remote-1440x900.png`; DOM/network summary: `report.json`.

This proves the supplied project/node URL cannot be played from this fresh
unauthenticated browser. It does **not** prove the prototype is missing or broken
in the user's signed-in session. Native connections, primary/recovery transitions,
saved fields, focus behavior, mobile and reduced motion are **NOT_VERIFIED**.

An earlier strict GET/HEAD-only trial blocked the page's automatic boot RPC and
showed `Sorry, we hit a snag.` That result was inconclusive and is superseded by
the normal page-initialization run above. No read-RPC payloads or credentials are
stored in the report; volatile URL query/fragment values are omitted.

## `get_screen` HTML export — flattened starting frame only

`../native-instant-prototype.html` renders a single Today page. Its only scripts
are Tailwind CDN and Tailwind configuration; there are no inline event handlers,
editor fields, linked child screens or connection runtime. The writing CTA is an
ordinary `/journal` anchor. The historical render screenshot
`raw-export-1440x900.png` remains workspace-local; the export itself is included.

This export cannot exercise the native connected prototype. The export lacking
connections is **not** evidence that Stitch's native node lacks them.

The rendered starting frame still has previously identified design/copy defects:

- It says Tuesday for 14/10/2026 (Wednesday).
- The rhythm card says no activities are scheduled while the main panel has two.
- It retains the invented breathing row and nervous-system claim, outside the
  actual fixture and agreed content boundary.
- The white Today work surface from the verified real-route baseline is absent.

These are visible starting-frame defects, not conclusions about native prototype
connections or current backend functionality. Native existence is reported by
the user; native UX QA cannot be marked passed from a flattened HTML render.

Historical workspace-only command:
`node .stitch/mb-642/inspect-native-prototype.mjs`. The inspection script is not
part of this evidence-only checkout; only the access report and selected remote
screenshot are included. No runnable native play bundle is claimed.

Only this QA script/evidence was added by the access-inspection subtask. No
production code, Git state, `.env`, shared database or running service changed.
