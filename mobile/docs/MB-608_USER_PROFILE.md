# MB-608 mobile USER profile evidence

MB-608 adds the authenticated USER profile flow to the shared Android/iOS
client. Care remains the authority for persisted profile data and versioning;
mobile does not derive an account identifier from the route, request body, or
token contents.

## Contract mapping

| Mobile behavior | Care endpoint           | Mobile decision                                                                |
| --------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Read profile    | `GET /api/v1/profile`   | Uses the authenticated subject at the API edge and validates the response.     |
| Empty profile   | `404 PROFILE_NOT_FOUND` | Opens the supported create form instead of treating the response as an outage. |
| Create profile  | `PUT /api/v1/profile`   | Sends no `If-Match` header and only supported editable fields.                 |
| Replace profile | `PUT /api/v1/profile`   | Sends the quoted persisted version in `If-Match`.                              |
| Stale write     | `412`                   | Reloads the authoritative profile before another save attempt.                 |

The request body contains only `displayName`, `dateOfBirth`, and `gender`.
Compatibility-only locale, timezone, and reminder fields are not written, and
the account ID is never accepted from the user interface.

## State and cache behavior

The screen has explicit initial loading, persisted data, source-empty,
dependency failure, unauthorized, forbidden, mutation pending/error/success,
and stale-version states. Field input remains visible after recoverable save
errors. A successful mutation updates the account-scoped TanStack Query cache
with the returned profile and marks it stale without issuing a duplicate
request. Re-entering the route always refreshes, while changing the Identity
subject selects a separate cache key.

Client validation handles shape and input format only. Care remains responsible
for the age rule and returns field violations that mobile maps to user-facing
Vietnamese copy.

## Automated evidence

The focused Jest suites cover exact REST paths, create/update `If-Match`
behavior, body field boundaries, strict response parsing, local validation,
server-owned age validation, read/create/update flows, stale-write reload,
unauthorized handling, dependency failure, and the USER-home entry point.
The `dev` pull-request gate typechecks mobile; the complete mobile quality,
bundle, and native boot gates remain staged for release validation.
