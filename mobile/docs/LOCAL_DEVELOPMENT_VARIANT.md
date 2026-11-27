# Local development alongside staging

The owner's 2026-11-20 request authorizes a separately installed local Expo
development app. This supersedes the shared development identity in the V1
delivery contract for this local testing workflow only.

| Build                     | Application ID                | URL scheme         |
| ------------------------- | ----------------------------- | ------------------ |
| Default / staging         | `com.mentalbridge.mobile`     | `mentalbridge`     |
| `APP_VARIANT=development` | `com.mentalbridge.mobile.dev` | `mentalbridge-dev` |

The Dev app is named **MentalBridge Dev**. Android's separate application ID
isolates its stored sessions from staging. Only this variant permits local HTTP.
The default app config retains its existing identity and network behavior.

Set `EXPO_PUBLIC_API_BASE_URL` to the local public API edge in `.env.local`, then
run `npm run start:dev -- --lan --port 8089`. The tablet must reach that host.
Changing laptop Wi-Fi requires updating the edge/Metro address, not rebuilding
the development APK. Changes to native dependencies still require a new APK.

Build with `APP_VARIANT=development` and Expo's Android prebuild before
`:app:assembleDebug`. Generated Android/iOS directories remain untracked.

The Dev launcher URL uses `mentalbridge-dev://expo-development-client/?url=...`.
Existing Identity email links and staging redirects retain their original
destinations; this change does not alter backend verification or redirect rules.
Do not route staging verification links into the Dev app.
