# MB-512 AI Companion frontend evidence

The `/messages` experience now consumes the Journal/AI-owned AI Companion
contract through authenticated same-origin Route Handlers. Browser code never
receives or stores a provider credential or the server-held Identity bearer.

Delivered behavior:

- resume conversation history, start a conversation, send a message, and
  permanently delete a conversation;
- show a deterministic loading state and preserve the draft after a failed
  request;
- display `FREE`/`PLUS` remaining responses and reset time from the provider;
- describe `PREMIUM` truthfully as having no displayed daily response limit
  while token, rate, and fair-use controls still apply;
- distinguish consent, quota, rate, token, provider, and context failures by
  stable provider code;
- allow at most three explicitly selected Journals and the current SupportPlan;
  reminder context remains disabled until its owner contract exists;
- keep the deterministic “Cần trợ giúp ngay” route visible independently of AI;
- validate every provider payload strictly before returning or rendering it.

Verification is split by evidence class:

- validation, server-only client/Route Handler, and component tests use
  synthetic provider values;
- Playwright exercises the mobile history/send/quota/context/delete journey and
  provider-failure draft recovery through same-origin HTTP fixtures;
- the companion backend PR owns real-Mongo concurrency, local-day reset,
  idempotency, consent, encryption, and deletion evidence;
- no live cross-stack, paid Gemini/OpenAI, or production-data run is claimed.

The PR description records the final command results and CI links. The source
of truth for conversation, retention, deletion, quota, context, and authority
boundaries is backend ADR 0021.

Local verification on 2026-09-22:

- format, lint, typecheck, all generated contract checks: passed;
- Vitest: 75 files / 362 tests passed;
- Next.js production build: passed;
- Playwright production-standalone suite: 53 passed, 7 live-only scenarios
  skipped by configuration, 0 failed; this includes both MB-512 mobile
  scenarios.
