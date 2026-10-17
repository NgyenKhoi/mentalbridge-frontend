# Reference rendering status

`report.json` is the final browser render run, not acceptance of the design.

Final source screens:

- desktop30da7195f4834d9b9f62bd43df12ac4b —1440×900 actual browser viewport.
- mobile8307652dfe2447038b369960b8e3834e —375×812 actual browser viewport.

Both final HTML pages loaded BeVietnamPro/Fraunces (3loaded font faces each),
had no JavaScript page errors and no horizontal overflow. The design gate still
fails surrounding chrome/page-composition parity, as recorded in `../brief.md`.
The captured PNGs show that mismatch; the tool's screen title is not evidence.

Earlier first correction actual render had desktop null.addEventListener and
mobile zero loaded faces for both fonts. Those faults were corrected by the
last Stitch repair; do not report them as current defects. Initial/corrected
HTML/PNG are retained in the parent evidence directory for traceability.

RN source baselines use actual existing components rendered through RNWeb with
synthetic read-only API/session/router substitutes. System font is intentional
for that source; there are no loaded brand webfonts. No native runtime/device
verification is claimed. Android/iOS execution: **NOT_RUN — MB-666**.
