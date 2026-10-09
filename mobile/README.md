# MentalBridge mobile

This directory contains the shared Android and iOS React Native client created
for MB-606. It is a delivery channel for existing MentalBridge backend
contracts; it does not own authentication, roles, clinical or support
decisions, appointments, or other business state.

MB-606 and every later mobile story follow the versioned
[`Mobile Delivery Contract v1`](docs/MB-611_MOBILE_DELIVERY_CONTRACT_V1.md).
Feature work must reference that contract rather than redefine public runtime,
authentication, error, deep-link, cache, or native identity conventions.

## Runtime baseline

- Expo SDK `57.0.26`
- React Native `0.86.3`
- React `19.2.3`
- TypeScript `6.0.x` in strict mode
- Node.js `22.13.0` with its bundled npm `10.9.2`
- Xcode `26.4.1` (`17E202`) for iOS native builds
- npm with the committed `package-lock.json`
- Expo Router `57.x` with protected route groups
- TanStack Query `5.x`
- Axios `1.x` and Zod `4.x`

Expo development builds are the agreed Android/iOS development path. Native
projects are generated locally through Continuous Native Generation and remain
untracked. `expo-secure-store` is included in the development build and backs
the credential-storage seam; credentials must never be moved to AsyncStorage,
source files, public configuration, logs, or test fixtures.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
npm start
```

Update `EXPO_PUBLIC_API_BASE_URL` in `.env.local` to the public API edge that is
reachable from the target device or emulator. The committed Android example
uses `10.0.2.2` to reach the host machine from the Android emulator. Do not put
credentials, provider keys, or private per-service URLs in any `EXPO_PUBLIC_*`
variable because Expo embeds those values in the application bundle.

Required public configuration:

| Variable                     | Purpose                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_BASE_URL`   | Absolute HTTP(S) URL of the approved public API edge        |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Request timeout from 100 through 30000 ms; defaults to 5000 |

Dev, staging, and production each inject one environment-appropriate value for
`EXPO_PUBLIC_API_BASE_URL`; the app never accepts per-service public URLs. The
exact environment strategy and frozen native identifiers are defined in the
Mobile Delivery Contract v1.

Startup fails with a bounded configuration error that names invalid keys but
does not print their values.

## Android and iOS development builds

Android requires Android Studio, an Android SDK, and an emulator or connected
device:

```powershell
npm run android
```

iOS local builds require macOS, Xcode 26.4.1, and an iOS 26.4.1 Simulator or
connected device. The staging smoke uses the `iPhone 17` simulator explicitly:

```powershell
npm run ios
```

Both commands run Expo prebuild when native directories are absent, compile a
development build, install it, and start Metro. Re-run the native build after
changing a native dependency or Expo config. Windows can develop and verify
the shared TypeScript bundle but cannot compile the iOS native target locally.

The staging release gate exercises these native paths with deterministic Release
smoke runs on an Android emulator and iOS Simulator. Those jobs compile, install,
relaunch, assert that the app stays alive, and upload screenshots and launch
diagnostics. The protected Android staging job then runs the MB-612 real-contract
Maestro journey on the same APK and emulator, proving PHQ-9 → GAD-7 → the
authoritative result → persisted SupportGuide. See
[`docs/NATIVE_VERIFICATION.md`](docs/NATIVE_VERIFICATION.md) for the exact
commands, assertions, artifacts, and local reproduction steps.

## Architecture boundaries

```text
App
├── validated public runtime configuration
├── TanStack Query provider + native online/app-focus lifecycle
├── Expo Router public route group
└── protected authenticated role groups
    ├── USER home and Care-backed personal profile
    └── SPECIALIST placeholder shell

Shared foundations
├── Axios API client: timeout, correlation ID, bearer injection seam
├── RFC 9457-compatible Problem Details normalization
├── SecureStore-backed credential abstraction
└── MentalBridge theme tokens and accessible screen/button primitives
```

The app starts by restoring credentials from SecureStore and confirms the
current account with Identity before opening the USER route group. MB-607 adds
USER registration, email-verification deep links, login, refresh rotation,
logout revocation, and fail-closed session restoration. Role, subject, account
status, and email-verification state come only from Identity's authenticated
`GET /api/v1/account` response; the app does not decode tokens to grant access.

The development-build verification link is
`mentalbridge:///verify-email?challenge=<one-time-challenge>`. It preserves the
existing Identity challenge query and consumption semantics. Production HTTP
links still require the approved web-domain Android App Link and iOS Universal
Link association; MB-607 does not redefine the backend email URL.
See [`docs/MB-607_AUTH_SESSION.md`](docs/MB-607_AUTH_SESSION.md) for the endpoint,
lifecycle, failure-state, deep-link, and automated-test evidence.

MB-608 adds the USER profile route backed only by Care's authenticated
`GET /api/v1/profile` and `PUT /api/v1/profile` contract. The mobile form sends
only supported editable fields, preserves optimistic concurrency through
`If-Match`, and reloads authoritative data after a stale write. See
[`docs/MB-608_USER_PROFILE.md`](docs/MB-608_USER_PROFILE.md) for contract, state,
cache, and automated-test evidence.

MB-612 adds the Care-backed authenticated assessment journey from PHQ-9 through
GAD-7 to the authoritative result and immutable post-screening SupportGuide. It
also reopens exact owner-scoped result/guide history and uses Care's explicit
help-now directory contract without local scoring or safety inference. See
[`docs/MB-612_ASSESSMENT_GUIDANCE.md`](docs/MB-612_ASSESSMENT_GUIDANCE.md) for
the API, state, safety, test, and staging Android demo evidence.

MB-625 adds the governed USER SupportPlan journey for authoritative draft/current
state, eligible choices and lifecycle actions, scheduled activity engagement,
terminal history, replacement review, and specialist proposal decisions. See
[`docs/MB-625_SUPPORT_PLAN.md`](docs/MB-625_SUPPORT_PLAN.md) for contract, cache,
failure-state, test, and Android persisted-activity evidence.

MB-613 adds the Journal-backed daily emotion check-in, owner-scoped history,
authoritative streaks and bounded 7/14/30-day coverage. It supports same-day
revision-aware updates and deletion without client-side mood scoring, averages,
causal analysis, recovery claims, or actor selection. See
[`docs/MB-613_EMOTION_CHECK_IN.md`](docs/MB-613_EMOTION_CHECK_IN.md) for the API,
state, cache, test, and staging Android persistence evidence.

MB-626 adds the Content-backed published Resources catalogue, reviewed detail,
supported article/practice/video interactions, and owner-scoped daily progress.
It preserves server completion semantics and keeps editorial authority out of
the app. See [`docs/MB-626_RESOURCES.md`](docs/MB-626_RESOURCES.md) for the API,
state, safety, test, and staging Android persistence evidence.

## Quality commands

MB-627 adds private USER Journal CRUD and explicit bounded AI reflection/time
comparison with Care consent, server-side entitlement enforcement and exact
revision/source provenance. See
[`docs/MB-627_PRIVATE_JOURNAL.md`](docs/MB-627_PRIVATE_JOURNAL.md) for the contract,
concurrency/privacy behavior, tests and protected exact-head Android proof.

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run build:bundle
```

Run the complete mobile gate with:

```powershell
npm run quality
```

`build:bundle` exports Android and iOS JavaScript bundles only; it is not native
compile or boot evidence. Native compile/install/launch is verified separately
by `npm run native:android:smoke` and `npm run native:ios:smoke` in the staging
release gate; Android also runs the MB-612 assessment and MB-613 emotion
real-contract journeys plus the MB-625 SupportPlan and MB-626 Resources
journeys, plus the MB-627 Journal safe-outcome journey, against the protected
staging edge. Assessment, emotion, Resources and Journal
share one dedicated USER fixture; SupportPlan uses a separate resettable
fixture. Pull requests into `dev` run only `npm run typecheck` for mobile;
formatting, lint, Jest, bundle export, native boot, and real-contract checks
wait for staging unless an explicit evidence label enables an exact-head run.

The synthetic welcome-screen review capture is documented in
[`docs/evidence/README.md`](docs/evidence/README.md).
