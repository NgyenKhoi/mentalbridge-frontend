# MB-696 acceptance boundary

- The approved Content provider contract exposes `coverage[]` (nationwide, province, or district). It does not expose a separate locale field. This client round-trips the complete authoritative coverage array and does not invent locale data.
- Stitch is not required for this story, per Product Owner approval.
- Authenticated, full-frame actual-route visual capture, keyboard walkthrough, and responsive-browser evidence remain **PENDING / NOT RUN** because no seeded ADMIN route session is available in this feature workspace. Component and BFF regression tests are not presented as a substitute for that evidence.
- No Android evidence is required for this web-only story.
