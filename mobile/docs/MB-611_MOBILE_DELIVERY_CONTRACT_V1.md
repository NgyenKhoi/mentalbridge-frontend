# Mobile Delivery Contract v1

**Version:** 1.0

**Status:** Frozen by MB-611

**Applies to:** all MentalBridge Android and iOS feature work from MB-606 onward

This contract defines how the React Native channel consumes authoritative
MentalBridge APIs. It does not define or replace any business-domain contract.
The backend remains authoritative for identity, authorization, lifecycle,
clinical, support, appointment, and other durable business decisions.

Changes to a rule marked **MUST** require a new reviewed contract version. A
mobile story may not silently work around an incompatible backend contract.

## Architecture baseline

- One React Native codebase serves USER and SPECIALIST role-based navigation.
- Expo development builds and Continuous Native Generation are the development
  model. Expo Go is not a production-development or release target.
- Expo Router owns navigation; TypeScript remains strict.
- Axios is the shared HTTP transport and TanStack Query owns server-state cache.
- SecureStore is the only mobile persistence mechanism for session credentials.
- React Hook Form and Zod are the approved form/validation direction when a
  feature needs them. Client validation mirrors shape and input constraints;
  backend services keep business validation authority.
- React Native StyleSheet and MentalBridge tokens remain the styling baseline.
- Jest and React Native Testing Library provide component/unit evidence;
  Maestro is the approved mobile E2E direction.
- npm and the committed `package-lock.json` are authoritative for dependency
  resolution.

The V1 client is not offline-first. Cache may improve presentation, but it MUST
NOT grant authorization, establish lifecycle truth, or confirm a mutation.

## Public runtime contract

Every build receives exactly one public edge URL through
`EXPO_PUBLIC_API_BASE_URL`. All service paths remain relative to this URL. The
client MUST NOT receive independent Identity, Care, Consultation, or other
service base URLs.

The edge is infrastructure routing only. It may route a request to an existing
authoritative service but MUST NOT make business decisions. A security-only web
proxy may be represented by an equivalent approved public backend contract.
Next.js-only composition or read-model orchestration MUST NOT be copied into
React Native; a reusable backend composition contract must be approved first.

| Environment | `EXPO_PUBLIC_API_BASE_URL` source                                                                                                  | Rule                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Development | Developer-owned `.env.local`; Android emulator example is `http://10.0.2.2:8080`, iOS simulator example is `http://127.0.0.1:8080` | It must resolve to the local public edge, never a private service URL.                                                              |
| Staging     | Staging build/release environment                                                                                                  | It must be the approved staging public edge. CI smoke values may be synthetic only when the smoke does not claim live API evidence. |
| Production  | Production build/release environment                                                                                               | It must be the approved production public edge before signing or store submission.                                                  |

`EXPO_PUBLIC_API_TIMEOUT_MS` is the only other public runtime value and defaults
to 5000 ms. Public configuration is embedded in the bundle, so it MUST contain
no credential, token, key, secret, protected-health data, or URL userinfo. The
runtime parser fails closed for a missing/invalid edge URL and reports only the
invalid key, never its value.

Exact staging and production edge hostnames are release-environment inputs, not
mobile feature decisions. Until deployment supplies an approved hostname, a
feature team must not infer one or fall back to a service's private address.

## Frozen application identity and deep links

The following identity is shared by dev, staging, and production builds in V1:

| Property               | Frozen value              |
| ---------------------- | ------------------------- |
| Display name           | `MentalBridge`            |
| Expo slug              | `mentalbridge-mobile`     |
| Android application ID | `com.mentalbridge.mobile` |
| iOS bundle identifier  | `com.mentalbridge.mobile` |
| Custom URL scheme      | `mentalbridge`            |

Using one identity means an environment build replaces another environment
build on the same device. Side-by-side environment installs require a reviewed
contract v2 and coordinated Identity redirect allow-list changes; feature teams
must not add ad hoc suffixes.

The V1 Identity verification link is:

```text
mentalbridge:///verify-email?challenge=<one-time-challenge>
```

Only the `verify-email` route consumes `challenge`, and Identity validates and
consumes that one-time value. A deep link never creates a session, grants a
role, or proves account ownership. Authentication still requires Identity's
login/refresh APIs and authenticated account response.

Production HTTPS Android App Links and iOS Universal Links require the approved
public web domain plus platform association files. That domain mapping is a
release configuration decision; the custom scheme above remains the explicit
development-build contract until the mapping is approved. Changing a scheme or
associated domain requires a native rebuild and coordinated Identity-link
configuration.

## Authentication and session rules

- Identity is the only authority for registration, verification, credentials,
  account state, subject, and roles. Mobile MUST NOT decode a token to grant
  access.
- Refresh and restart credentials live only in platform SecureStore. They MUST
  NOT appear in AsyncStorage, public environment values, source, analytics,
  logs, or user-visible errors.
- Missing, partial, expired, revoked, replayed, inactive, unverified, or
  unsupported-role sessions fail closed.
- Dependency unavailability keeps protected navigation closed. Restore may
  retain valid stored credentials for explicit retry; it never treats cache as
  proof of a session.
- Logout follows server revocation semantics, then clears local credentials and
  the TanStack Query cache even when the revocation dependency is unavailable.
- Account-scoped query keys include the authenticated subject. A different
  subject cannot inherit another account's cached data.

## HTTP, errors, and observability

- Requests use relative approved API paths through the single Axios client.
- Authenticated calls receive the current bearer credential through the shared
  injection seam. Feature modules MUST NOT build authorization headers from
  persisted storage directly.
- Every request carries an `X-Correlation-Id`. RFC 9457-compatible Problem
  Details preserve stable `code`, `status`, field violations, and
  `correlationId` when supplied.
- Dependency/network failures, timeouts, authorization failures, validation
  failures, and stale-version conflicts remain distinguishable. UI copy may be
  friendly but MUST NOT erase the stable programmatic code.
- 4xx queries are not automatically retried. Transient reads use the bounded
  shared retry policy. Mutations are never automatically retried.
- Tokens, verification challenges, sensitive health data, request bodies, and
  private service topology MUST NOT be logged.

## Cache and mutation rules

- Server responses remain authoritative. Query cache is presentation state,
  not a permission or business-state store.
- A mutation is successful only after the authoritative server confirms it.
- Replacement updates use the owner contract's concurrency mechanism, such as
  `If-Match`, when required.
- Offline queued domain mutations are outside V1. A future owner contract must
  explicitly define replay, idempotency, conflict, and user-consent behavior
  before such a queue is introduced.

## Version-pinned build assumptions

| Layer      | V1 baseline                                                                |
| ---------- | -------------------------------------------------------------------------- |
| Expo       | SDK `57.0.26`; Expo Router `57.0.24`                                       |
| Runtime    | React Native `0.86.3`; React `19.2.3`                                      |
| Language   | TypeScript `6.0.3`, strict mode                                            |
| Node/npm   | Node `22.13.x` or newer compatible 22.x; npm with lockfile v3 and `npm ci` |
| Android CI | Ubuntu `24.04`, Temurin JDK `17`, Android API `36`, x86_64 emulator        |
| iOS CI     | macOS `26`, Xcode `26.4` or newer, available iPhone Simulator              |

`package.json`, `package-lock.json`, `app.json`, and the staging workflow are
the executable sources for these pins. Android is the mandatory local
development/demo target on the current Windows environment. iOS source and
configuration MUST remain compatible; its native compile runs on macOS/cloud.

Pull requests into `dev` run a clean mobile install and strict TypeScript
compile only. Staging promotion runs format, lint, Jest, Android/iOS JavaScript
exports, and native Android/iOS compile/install/boot smoke evidence.

## Executable evidence

- `runtime-config.test.ts` verifies the required single edge URL, bounded
  timeout, supported protocols, and rejection of embedded credentials.
- `mobile-delivery-contract.test.ts` prevents drift in app identity, URL scheme,
  public environment keys, and the core SDK/toolchain versions.
- `api-client.test.ts` covers bearer injection, correlation IDs, RFC 9457
  normalization, and safe timeout behavior.
- Identity session tests cover fail-closed restoration, rotation, revocation,
  secure cleanup, and Query-cache cleanup on logout.
- Email-verification tests cover one-time challenge handling without treating a
  link as an authenticated session.

MB-606 provides the shared foundation, MB-607 implements the Identity/session
slice, and MB-608 implements the Care profile slice. Those implementations and
all future mobile stories inherit this contract instead of redefining their own
transport, authentication, error, configuration, deep-link, or cache rules.
