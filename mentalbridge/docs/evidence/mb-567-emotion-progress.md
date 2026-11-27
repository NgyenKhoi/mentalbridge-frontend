# MB-567 emotion history and progress evidence

## Scope

The dashboard now consumes Journal/AI's authoritative daily emotion progress
read model and the existing owner history. The browser does not calculate
streaks or coverage. It supplies the current IANA timezone, validates the
provider response at the server boundary, and renders current/longest streaks,
7/14/30-day checked-in-day coverage, self-reported label counts, and up to 30
recent entries.

The public history omits the optional private note. Copy states factual counts
only and explicitly avoids diagnosis, improvement, adherence, and recovery
claims. Empty, sparse, loading, and retryable dependency states do not invent a
trend.

## Automated evidence

- Server-client tests validate owner history and the timezone-anchored progress
  response, including rejection of inconsistent distribution totals.
- Route-handler tests cover authenticated forwarding and reject invalid,
  duplicate, or owner-controlled query values.
- Component tests cover 7/14/30 switching, authoritative streak values,
  history presentation without notes, zero-data truthfulness, refresh after a
  persisted same-day change, and bounded error copy.
- The full frontend suite passed with 513 tests, followed by a production Next
  build.
- `tests/e2e/emotion-check-in.spec.ts` passed against the controlled production
  standalone fixture. It covers failed-save retry, persisted reload, same-day
  update, authoritative progress refresh, history, and the resulting responsive
  card. It produces `mb-567-emotion-progress.png` with synthetic data.

Regenerate the focused browser evidence after `npm run build` with:

```text
npx playwright test tests/e2e/emotion-check-in.spec.ts --reporter=line
```

The screenshot is controlled fixture-browser evidence, not proof of a deployed
live cross-stack environment.
