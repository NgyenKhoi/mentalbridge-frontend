# Story 6201 Journal authoring

Story 6201 extends the existing private Journal CRUD journey with an intentional
mood choice, reflection prompts, clear save feedback, and protection for
unsaved work. The browser continues to use only the same-origin Journal BFF;
provider credentials and encryption details remain server-side concerns.

## Product and interaction decisions

- Journal content remains plain text. Prompt selection changes the editor
  placeholder and is not persisted.
- A new entry requires one of `GREAT`, `GOOD`, `OKAY`, `LOW`, or `VERY_LOW`.
  Emoji and Vietnamese labels are presentation-only; the stable enum is sent to
  the provider and encrypted with each revision.
- Existing entries without a mood remain readable. Editing one requires the
  author to choose a mood before saving the next revision.
- There is no background autosave and raw Journal text is not written to browser
  storage. A draft stays in React memory while the editor is open.
- Closing a changed editor, following an internal link, or unloading the page
  requires confirmation. A rejected or ambiguous save leaves all fields in
  place. A successful save is the only event that clears the draft.
- Revision conflicts reload the authoritative revision while preserving the
  local text, tags, and mood so the author can review and retry.

## Verification evidence

The component and Route Handler tests cover exact contract validation, mood
forwarding, inline errors, focus, ambiguous-save retry with the same idempotency
key, draft retention, and revision conflict recovery.

The controlled Playwright journey exercises create, failed save, unsaved-close
protection, reload, edit, conflict recovery, successful revision, and delete
through the real same-origin BFF. It also checks the 375 px portrait and 812 px
landscape layouts for horizontal overflow. The fixture provider is controlled
and the screenshots contain synthetic Journal content only; this is
`fixture-browser` evidence, not live cross-stack proof.

Regenerate the browser evidence after a production build with:

```powershell
npx playwright test tests/e2e/journal.spec.ts --project=chromium
```

The provider contract and real disposable-MongoDB verification live in the
backend repository's Journal module documentation and integration test.
