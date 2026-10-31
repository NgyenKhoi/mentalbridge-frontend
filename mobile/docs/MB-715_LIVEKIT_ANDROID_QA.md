# MB-715: LiveKit Android staging QA

## Purpose and evidence boundary

This runbook verifies the existing MB-384 video consultation on an approved
Android build and staging backend. It does not redefine the video contract or
add a native build to ordinary development pull requests. Coordinate one shared
milestone APK with MB-662 and reuse the resulting evidence in the MB-666
capstone demo.

A green TypeScript, Jest, bundle-export, browser LiveKit, or skipped Android
workflow result is **not** Android RTC evidence. A native result is valid only
when an Android client joins a real LiveKit Cloud room with the exact build and
backend/provider configuration recorded below. Browser evidence remains
separate and may cover the second participant, but cannot replace the Android
participant.

Provider keys, participant tokens, fixture passwords, private account details,
raw webhook bodies, and clinical content must not enter this repository,
screenshots, logs, or the Expo public environment.

## Result classification

Keep source-delivery status and runtime status separate. Authored flows remain
`TEST_AUTHORED_NOT_RUN` until the shared milestone executes them. Use exactly
one runtime result for each recorded staging attempt:

| Result             | Meaning                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STAGING_PASS`     | Every mandatory scenario below ran on the recorded Android build against the recorded approved staging/provider configuration. Bidirectional media and verified completion/credit evidence are attached and sanitized.                                                            |
| `STAGING_FAIL`     | All required build, fixture, provider, callback, and device prerequisites were available, but at least one mandatory product assertion failed. Record the first failing step, expected/observed behavior, timestamps, and sanitized diagnostics.                                  |
| `BLOCKED_PROVIDER` | A required approved staging/provider prerequisite was absent or could not be verified, including the shared APK, paired fixture, LiveKit Cloud mode, signed callback, backend SHA, authorized credentials, or physical Android device. Do not reinterpret this as `STAGING_PASS`. |

An authored Maestro flow proves only the UI steps that it actually asserts. It
cannot prove RTP delivery, audible bidirectional audio, a signed provider
webhook, attendance, completion, or credit settlement.

## Required preflight

The operator must complete all rows before opening either participant's room.

- [ ] Record the exact frontend commit and APK/dev-build artifact SHA. Confirm
      the APK is the shared MB-662 milestone build, not a per-story rebuild.
- [ ] Record the exact backend deployment SHA and approved public staging edge.
- [ ] Confirm the backend is in real LiveKit Cloud mode. Verify the callback is
      configured for `POST /internal/v1/video/livekit/webhook` and that the
      backend owns its signing credentials. Do not expose their values.
- [ ] Provision two synthetic, ACTIVE and email-verified accounts: one `USER`
      and one `SPECIALIST`. Both must refer to the same confirmed
      `IN_APP_VIDEO` appointment and its resettable credit/slot fixture.
- [ ] Record the appointment's initial status, policy version, credit state,
      start/end window, and fixture reset identifier without retaining account
      names, email addresses, tokens, or the raw appointment identifier.
- [ ] Prepare either two approved devices, including at least one physical
      Android device, or one Android device plus the separately identified web
      peer. Synchronize their wall clocks and record the time zone.
- [ ] Confirm Android camera/microphone permissions can be reset, a headset or
      Bluetooth route is available where supported, and network interruption
      can be controlled.
- [ ] Prepare sanitized backend/provider observation for signed, invalid,
      duplicate, and absent/late webhook cases. Never fabricate attendance or
      edit completion/credit state directly.

If any preflight row cannot be satisfied, stop before claiming media evidence
and classify the run `BLOCKED_PROVIDER` with the missing row named.

## Android and two-party checklist

The USER and SPECIALIST run the same-authority appointment. Preserve wall-clock
timestamps for every join, disconnect, webhook, completion request, and final
read.

### 1. Permissions and local preview

- [ ] With Android camera and microphone denied, open the video panel and start
      device preview. The app explains the missing permission without joining a
      room or claiming attendance.
- [ ] Grant camera and microphone, retry preview, and verify local video plus
      local audio capture. Preview remains local and is labelled as not connected
      to the other participant.
- [ ] Revoke one permission and retry its control. The UI remains usable and
      explains how to restore the permission without exposing provider details.

### 2. Authority and time boundaries

- [ ] Before the waiting window, neither role can preview or join.
- [ ] From five minutes before `startsAt`, local preview is available but cloud
      join remains unavailable.
- [ ] At the server-authoritative `startsAt`, both eligible roles can explicitly
      request access. A restricted role, wrong account, wrong appointment, or
      otherwise ineligible participant remains denied.
- [ ] A no-show or early leave does not fabricate attendance, completion, credit
      consumption, or specialist earning.
- [ ] At and after `endsAt`, new access is denied and reconnect never extends
      the appointment window.

### 3. Real two-party media

- [ ] Join the real LiveKit Cloud room from Android and the paired participant.
      Record join request, connected, and first-remote-media timestamps.
- [ ] Both participants see the remote participant and receive moving remote
      video. Capture sanitized proof from the Android device.
- [ ] Both participants hear distinct live audio in both directions. Record the
      human observation; a screenshot alone cannot satisfy this row.
- [ ] Toggle Android microphone off/on and camera off/on. The local control state
      and the peer's observed media agree after each transition.
- [ ] Exercise speaker/earpiece and an available wired or Bluetooth headset
      route. Record unsupported hardware as an environmental note, never as an
      unexecuted pass.

### 4. Lifecycle and reconnect

- [ ] Background Android while joined. Media and access stop; returning to the
      foreground does not silently reconnect.
- [ ] Explicitly rejoin while the server window remains open and verify
      bidirectional media again.
- [ ] Interrupt the network and restore it before the cutoff. Observe the
      reconnecting state and verify recovery or a bounded error with an explicit
      retry path.
- [ ] Repeat the interruption across the cutoff. The client must not reconnect
      after the authorized window.
- [ ] Close the panel or navigate away and return. Old access and device tracks
      are cleared, and a fresh explicit join is required.

### 5. Provider attendance, completion, and credit

- [ ] With the signed provider callback absent, late, or invalid, specialist
      confirmation stays pending/evidence review; appointment completion,
      credit consumption, and earning are not fabricated.
- [ ] Send the approved signed provider events for the real overlapping
      participants. Confirm the backend records verified attendance derived from
      the provider rather than a client assertion.
- [ ] Replay the same provider confirmation. Exactly one attendance/completion
      effect remains; the duplicate does not consume another credit or create
      another earning.
- [ ] The SPECIALIST explicitly reviews and sends completion. Record the stable
      request identity/revision outcome without recording its secret value.
- [ ] After verification, owner reads show `VERIFIED`, terminal completion, and
      the expected single credit transition/earning. Both clients can no longer
      join.
- [ ] Re-read the appointment and credit state after app restart. The verified
      result persists and no duplicate financial effect appears.

## Maestro scope

The author-only flows `.maestro/mb-715-livekit-user.yaml` and
`.maestro/mb-715-livekit-specialist.yaml` may automate sign-in, appointment
navigation, panel opening, and visible join/completion controls against the
approved fixture. They remain `TEST_AUTHORED_NOT_RUN` until the MB-662/MB-666
protected device milestone supplies the exact build and fixture. Run either
role's bounded UI automation from `mobile/`; this command deliberately emits
`AUTOMATED_UI_PASS_ONLY`, never `STAGING_PASS`:

```bash
MB715_ANDROID_ROLE=USER bash scripts/verify-android-video-e2e.sh
MB715_ANDROID_ROLE=SPECIALIST bash scripts/verify-android-video-e2e.sh
```

The runner also requires the matching protected role credentials,
`MB715_APK_SHA256`, the full `MB715_BACKEND_SHA`,
`MB715_PROVIDER_MODE=approved-staging-livekit-cloud`, and a physical device
selected through `ANDROID_DEVICE` when more than one target is connected. Run
the paired-media, audio-route, lifecycle, provider, and settlement rows above
under an operator; do not extend Maestro assertions into claims it cannot
observe.

## Evidence record

Attach the sanitized report and captures to the protected run or Jira issue,
not to source control. Every result must contain:

- Jira key and unique run identifier;
- overall result and, for `STAGING_FAIL` or `BLOCKED_PROVIDER`, the exact first
  failing or missing prerequisite;
- UTC and local start/end timestamps plus time zone;
- frontend commit, APK/dev-build artifact SHA, application version, and build
  profile;
- Android make/model, OS/API level, physical-device or emulator classification,
  and a redacted device identifier;
- peer type/device and its exact web build SHA when a browser is used;
- backend deployment SHA, public-edge configuration mode, and frozen public
  contract version;
- LiveKit provider mode/project alias, callback route verification time, and
  signed-webhook verification outcome, without keys or raw bodies;
- resettable fixture contract: pseudonymous USER/SPECIALIST aliases, same
  appointment assertion, modality, policy, slot/window, and initial/final credit
  states;
- permission, preview, join, first-remote-media, toggle, audio-route,
  background/reopen, reconnect, cutoff, completion, and final-read observations;
- sanitized Android screenshots/video and backend/provider diagnostics, with
  private identifiers, health content, credentials, tokens, and payloads removed;
- a separate link to any web/browser LiveKit evidence, explicitly labelled as
  non-Android evidence.

Before attaching a `STAGING_PASS` or `BLOCKED_PROVIDER` JSON manifest, validate
it offline from `mobile/`:

```bash
node scripts/verify-android-livekit-evidence.mjs path/to/sanitized-manifest.json
node --test scripts/verify-android-livekit-evidence.test.mjs
```

The exact fail-closed manifest shape is exercised in
[`verify-android-livekit-evidence.test.mjs`](../scripts/verify-android-livekit-evidence.test.mjs).
The validator rejects unknown fields, secret-shaped fields/values, unsafe
artifact paths, incomplete revisions, emulator-only evidence, incomplete
two-way media/permission/reconnect/window proof, unverified callbacks, and any
completion result other than one verified completion with one consumed ledger
event. A `STAGING_FAIL` report remains a sanitized operator report with the
first failed assertion; it must never be submitted to this validator as a
candidate pass.

## Current execution record — 2026-10-31

**Overall result: `BLOCKED_PROVIDER`.**

- Documentation baseline: frontend `d1f08591`; no MB-662 approved APK/build SHA
  was supplied for this run.
- Backend deployment SHA and approved staging API edge: not supplied.
- Paired resettable USER/SPECIALIST appointment fixture and authorized
  credentials: not supplied.
- LiveKit Cloud project mode, signed callback configuration, and provider
  observation access: not verified or supplied.
- Android/peer run, bidirectional media, webhook attendance, completion, and
  credit evidence: not executed because the mandatory provider preflight was
  incomplete.
- The current staging workflow's skipped Android job and any green web/mobile
  compile checks do not change this classification.

Resume only through the shared MB-662/MB-666 staging milestone after the missing
approved inputs are available. Replace this record with a new exact-build run;
never promote the blocked record to `STAGING_PASS` without executing every
mandatory row.
