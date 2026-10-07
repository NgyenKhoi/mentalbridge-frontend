# Native development-path verification

MB-606 distinguishes JavaScript bundle export from a native app boot. An
`expo export` result proves that Metro can produce platform bundles; it does not
prove that Gradle or Xcode can compile, install, and launch the native app.

## Required staging evidence

Promotions from `dev` to `staging` run two required smoke jobs:

| Job                                  | Agreed path exercised                                                                  | Passing evidence                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Android native boot and assessment` | Release native boot, then MB-612 Maestro journey against the approved staging API edge | CNG prebuild, Gradle compile, APK install, live foreground app, PHQ-9 → GAD-7 → authoritative result → persisted SupportGuide reopen, screenshot and sanitized manifest artifacts |
| `iOS native boot`                    | `expo run:ios --configuration Release --no-bundler`                                    | CNG prebuild, CocoaPods/Xcode compile, simulator install, explicit relaunch, live app PID, screenshot artifact                                                                    |

Both jobs embed only the public environment configuration from the workflow.
The Android job is attached to the protected `staging-mobile-e2e` Environment;
its staging API edge and dedicated USER fixture credentials come from
Environment secrets and are never included in artifacts. The
`android-native-and-assessment-*` and `ios-native-boot-*` artifacts contain the
screenshot and sanitized diagnostics produced for that exact commit. The repository
`staging-quality-gate` depends on both jobs, so bundle-only verification cannot
satisfy the release gate. Pull requests into `dev` intentionally run only the
mobile TypeScript compile check.

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
