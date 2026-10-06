# Native development-path verification

MB-606 distinguishes JavaScript bundle export from a native app boot. An
`expo export` result proves that Metro can produce platform bundles; it does not
prove that Gradle or Xcode can compile, install, and launch the native app.

## Required staging evidence

Promotions from `dev` to `staging` run two required smoke jobs:

| Job                   | Agreed path exercised                               | Passing evidence                                                                                                                    |
| --------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Android native boot` | `expo run:android --variant release --no-bundler`   | CNG prebuild, Gradle compile, APK install, explicit launcher restart, live app PID, resumed-activity assertion, screenshot artifact |
| `iOS native boot`     | `expo run:ios --configuration Release --no-bundler` | CNG prebuild, CocoaPods/Xcode compile, simulator install, explicit relaunch, live app PID, screenshot artifact                      |

Both jobs embed only the public test configuration from the workflow. Their
`android-native-boot-*` and `ios-native-boot-*` artifacts contain the screenshot
and launch diagnostics produced for that exact commit. The repository
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

iOS requires macOS, Xcode 26.4 or newer, CocoaPods, `jq`, and an installed
iPhone Simulator:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080 \
EXPO_PUBLIC_API_TIMEOUT_MS=5000 \
npm run native:ios:smoke
```

Set `IOS_DEVICE` to a simulator UDID to select a specific device. The script
fails unless the app is installed, an explicit launch returns a PID, and that
process remains alive after the startup window.

Evidence is written to ignored `native-evidence/`. CI uploads it even when a
smoke job fails, which keeps boot failures reviewable without committing
generated native projects or machine-specific build output.
