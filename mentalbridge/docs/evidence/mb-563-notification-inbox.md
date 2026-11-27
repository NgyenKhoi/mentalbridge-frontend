# MB-563 persisted notification inbox evidence

## Browser boundary

`/notifications` now loads the authenticated user's durable inbox through a
same-origin BFF. The browser receives no access token, owner ID, producer
identity, or arbitrary URL. Provider responses are validated against the
generated Content OpenAPI types and a stricter runtime parser before rendering.

The page implements loading, empty, dependency-error, continuation, deleted or
expired, and successful states. A single read, bulk read, and delete call the
backend before updating visible state. Approved notification actions contain a
server-derived relative path; malformed, external, or target-mismatched actions
are rejected as dependency responses rather than becoming navigation.

## Verification

- Route tests cover authenticated forwarding, bounded cursor input,
  single/bulk read, deletion, gone records, and dependency failure.
- Component tests cover persisted item rendering, read-before-navigation,
  continuation, bulk read, deletion, empty state, and retryable load failure.
- Runtime validation tests reject arbitrary action URLs, mismatched resource
  targets, inconsistent read state, and inconsistent continuation state.
- The fixture Playwright journey persists read and delete state across reloads
  and retains the MB-562 privacy/safety assertions.

Live cross-stack producer verification remains attached to MB-564 and MB-565,
which own the real Journal/emotion and remaining domain event mappings.
