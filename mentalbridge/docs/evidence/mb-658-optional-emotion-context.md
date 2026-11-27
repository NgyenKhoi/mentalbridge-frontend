# MB-658 — optional emotion context

Evidence class: controlled fixture-browser plus automated contract, component,
mobile-consumer and provider coverage. Every identity and check-in shown in the
captures is synthetic.

## Product and privacy decisions

- Emotion and intensity remain the only required inputs. The context section is
  collapsed by default and can be skipped.
- The stable factor codes are `sleep`, `work`, `study`, `family`, `friends`,
  `health` and `other`; the UI presents Vietnamese labels and permits at most
  three unique choices.
- The private note is optional and limited to 500 characters. Factors and the
  note are saved only when the owner activates the existing save action. The
  disclosure explains that they are for the owner's review and are not sent
  automatically to AI, Support Plan or analytics.
- The provider stores context only inside the existing AES-GCM encrypted
  check-in payload. Owner authorization, retention, export, delete, local-day,
  timezone, revision and idempotency semantics remain those of the check-in.
- Downstream progress projections contain neither factors nor notes. No log,
  event, diagnostic inference or cross-domain reuse was introduced.
- Existing encrypted records need no database rewrite: a legacy payload without
  `factors` is read as an empty list, and an absent note remains `null`.

## Automated evidence

- Provider tests cover omitted optional input, encrypted persistence and reload,
  edit, clear, legacy payloads, duplicate/unknown/oversized factors, oversized
  notes, projection exclusion, owner isolation, delete and revision conflicts.
- Web contract/client/component tests cover old-client compatibility, restore,
  max-three selection, clear, request serialization and response validation.
- React Native focused tests cover restore and clear through the versioned
  contract; TypeScript and lint gates validate the mobile consumer.
- `emotion-check-in.spec.ts` covers failed-save retry with one stable
  idempotency key, persisted context after reload, explicit clearing, renewed
  session, responsive layout and the existing edit/delete journey.

Android native execution is `NOT_RUN`: MB-658's Jira addendum explicitly defers
the staging-device milestone to MB-666. The focused React Native tests and
TypeScript/lint gates remain required and are recorded in the pull request.

The controlled captures are:

- `mb-658-emotion-context-desktop.png` — expanded optional context on desktop.
- `mb-658-emotion-context-mobile.png` — the same saved context at 390 px.

Regenerate the captures after `npm run build` with:

```text
node scripts/run-e2e.mjs tests/e2e/emotion-check-in.spec.ts --workers=1 --reporter=line
```
