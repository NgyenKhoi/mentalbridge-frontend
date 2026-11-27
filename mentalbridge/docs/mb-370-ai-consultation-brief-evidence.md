# MB-370 optional AI ConsultationBrief draft evidence

The appointment detail UI offers AI only after the user has saved an exact
private ConsultationBrief draft. It loads the backend-owned current
`AI_PROCESSING` disclosure and requires the matching grant before requesting a
job.

The browser stores only the job identifier for reload recovery. It polls the
owner-scoped BFF route and applies a successful suggestion only when appointment,
brief, brief version, and SupportEvaluation identifiers still match. The AI may
prefill situation and goals; it cannot alter the screening source, save the
draft, approve it, share it, or grant specialist access.

The result is labelled as an AI suggestion and remains editable. Source version,
provider, model, and prompt provenance are available in collapsed details.
Provider, consent, stale-source, malformed-result, and transport failures leave
the existing manual fields and save flow usable. If the user edits the draft
while generation is running, the returned suggestion is rejected instead of
overwriting those newer edits.

Component tests verify editable prefill without automatic save/approval and the
manual fallback. Care boundary validation rejects extra, incomplete, stale, or
malformed job responses.
