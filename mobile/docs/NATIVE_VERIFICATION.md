# Native development-path verification

## Dev review and staging milestone policy

Mobile changes in pull requests into `dev` have no mobile cloud job. The
required `quality-gate` reports `NOT_RUN (staging milestone pending)` for this
scope. Reviewers use source changes and optional local evidence; this status
must never be presented as native or device-test success.

The complete mobile gate runs at an intentional staging milestone, either on a
promotion to `staging` or through the `Frontend staging release gate` manual
dispatch. Android is required; a skipped Android job fails the final staging
gate. Manual dispatch is accepted only from `dev` or `staging`, requires the
operator to enter the exact selected frontend SHA, exact deployed backend SHA,
staging deployment ID and fixture dataset version, and fails closed before the
protected Environment if any identifier is absent or invalid.

MB-606 distinguishes JavaScript bundle export from a native app boot. An
`expo export` result proves that Metro can produce platform bundles; it does not
prove that Gradle or Xcode can compile, install, and launch the native app.

## Required staging evidence

Promotions from `dev` to `staging` run two required smoke jobs:

| Job                                | Agreed path exercised                                                                                                               | Passing evidence                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Android native boot and journeys` | Release native boot, then MB-612, MB-613, MB-625, MB-626, MB-627, and MB-633 Maestro journeys against the approved staging API edge | CNG prebuild, Gradle compile, APK install, live foreground app, persisted SupportGuide, emotion history/progress, SupportPlan occurrence complete/reload/reopen/reload, reviewed Resource progress/restart/reload, private Journal safe-outcome, SPECIALIST profile plus availability publish/withdraw/reload, screenshots and sanitized manifests |
| `iOS native boot`                  | `expo run:ios --configuration Release --no-bundler`                                                                                 | CNG prebuild, CocoaPods/Xcode compile, simulator install, explicit relaunch, live app PID, screenshot artifact                                                                                                                                                                                                                                     |

Both jobs embed only the public environment configuration from the workflow.
The Android job is attached to the protected `staging-mobile-e2e` Environment;
its staging API edge and dedicated USER fixture credentials come from
Environment secrets and are never included in artifacts. The
`android-native-and-real-contract-*` and `ios-native-boot-*` artifacts contain the
screenshot and sanitized diagnostics produced for that exact commit. The repository
`staging-quality-gate` depends on both jobs, so bundle-only verification cannot
satisfy the release gate. The Android milestone builds and installs once, then
reuses that exact APK for all Maestro journeys. It records per-phase durations
and exit status even for a failed phase, and uploads the reusable APK with the
sanitized frontend/backend/contract/deployment/fixture provenance.

Release configuration is intentional in CI: the JavaScript bundle is embedded,
so the app can boot without leaving a long-running Metro process. Local feature
development continues to use the documented Debug paths, `npm run android` and
`npm run ios`; all four commands invoke Expo's native `run` path rather than
`expo export`.

## Reproduce locally

Android requires a booted emulator or connected device and Android SDK tools:

```powershell
$env:EXPO_PUBLIC_API_BASE_URL = 'http://10.0.2.2:8080'
$env:EXPO_PUBLIC_API_TIMEOUT_MS = '5000'
npm run native:android:smoke
```

Set `ANDROID_DEVICE` to an `adb devices` serial when more than one target is
available. The script fails unless the package is installed, relaunched,
remains alive, and owns Android's resumed foreground activity.

### Physical Android device from Windows

Enable USB debugging, connect the device, and confirm its serial:

```powershell
adb devices
$env:ANDROID_DEVICE = '<device-serial>'
adb reverse tcp:8080 tcp:8080
$env:EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:8080'
npm run android
```

USB reverse is the preferred local path. For Wi-Fi testing, use
`http://<host-lan-ip>:8080`, keep the phone and workstation on the same trusted
network, and allow only the development port through the firewall. The Android
emulator-only address `10.0.2.2` does not work on a physical phone.

Keep Metro running with `npm start` for Fast Refresh. Rebuild the development
app only after changing a native dependency, Expo config/plugin, application
identity, or native project input; JavaScript and TypeScript edits reuse the
installed development build.

For an on-demand release APK and full local Android milestone:

```powershell
npm run milestone:android
```

The native phase writes `native-evidence/mentalbridge-<revision>.apk`. Install
that exact artifact again with `adb install -r <apk-path>`; no dedicated EC2
builder is required.

The MB-612 real-contract journey additionally requires the protected dedicated
USER fixture and Maestro `2.11.0`:

```powershell
$env:MAESTRO_MB_USER_EMAIL = 'dedicated-user@example.invalid'
$env:MAESTRO_MB_USER_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:assessment
```

It fails unless the real server accepts PHQ-9 followed by GAD-7, returns the
authoritative result and SupportGuide, and the app can return to history and
reopen that persisted guide.

The MB-625 real-contract journey uses a separate protected USER fixture with an
active SupportPlan and a scheduled occurrence:

```powershell
$env:MAESTRO_MB_SUPPORT_PLAN_USER_EMAIL = 'dedicated-plan-user@example.invalid'
$env:MAESTRO_MB_SUPPORT_PLAN_USER_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:support-plan
```

It fails unless the occurrence can be completed, reloaded from Care as
completed, reopened, and reloaded again as scheduled. The fixture must be
resettable and contain no production personal data.

The MB-613 journey uses the same protected fixture and already installed APK:

```powershell
$env:MAESTRO_MB_USER_EMAIL = 'dedicated-user@example.invalid'
$env:MAESTRO_MB_USER_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:emotion
```

It creates a deterministic current-day check-in, verifies the returned history
and factual 7-day coverage, restarts the app, and verifies that the real server
state reloads. A prior same-day fixture record is deleted through the product UI
first so repeated protected runs remain reproducible.

The MB-626 journey uses the same protected fixture and installed APK:

```powershell
$env:MAESTRO_MB_USER_EMAIL = 'dedicated-user@example.invalid'
$env:MAESTRO_MB_USER_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:resources
```

It filters the authoritative published catalogue, opens a reviewed Resource,
records completion when needed, restarts the app, and verifies persisted
owner-scoped progress. Its evidence manifest excludes Resource bodies and
request payloads.

The MB-633 journey uses a separate approved SPECIALIST fixture and the same
installed APK:

```powershell
$env:MAESTRO_MB_SPECIALIST_EMAIL = 'dedicated-specialist@example.invalid'
$env:MAESTRO_MB_SPECIALIST_PASSWORD = 'from-protected-secret-store'
npm run e2e:android:specialist
```

It loads the authoritative professional profile, publishes an exact 60-minute
online slot, withdraws it, reloads the owner list and verifies the persisted
tombstone. The script chooses a future date by default; optional
`MAESTRO_MB_SPECIALIST_SLOT_DATE` and `MAESTRO_MB_SPECIALIST_SLOT_TIME` values
can make a protected fixture run deterministic.

iOS requires macOS, Xcode 26.4.1 (`17E202`), CocoaPods, `jq`, and the iOS 26.4.1
`iPhone 17` simulator used by staging:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080 \
EXPO_PUBLIC_API_TIMEOUT_MS=5000 \
npm run native:ios:smoke
```

Set `IOS_DEVICE` to a simulator UDID to select a specific device. The script
otherwise selects only `iPhone 17` from
`com.apple.CoreSimulator.SimRuntime.iOS-26-4`; it does not select the first
available iPhone. The script fails unless the app is installed, an explicit
launch returns a PID, and that process remains alive after the startup window.

Evidence is written to ignored `native-evidence/`. CI uploads it even when a
smoke job fails, which keeps boot failures reviewable without committing
generated native projects or machine-specific build output.
