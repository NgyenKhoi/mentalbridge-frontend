#!/usr/bin/env bash

set -euo pipefail

readonly package_name='com.mentalbridge.mobile'
readonly evidence_dir="${NATIVE_EVIDENCE_DIR:-native-evidence}"
readonly role="${MB715_ANDROID_ROLE:-}"
readonly fixture_contract='two-party-confirmed-in-app-video-v1'

command -v adb >/dev/null || {
  echo 'adb is required for MB-715 Android UI automation.' >&2
  exit 1
}
command -v maestro >/dev/null || {
  echo 'Maestro is required for MB-715 Android UI automation.' >&2
  exit 1
}

case "$role" in
  USER)
    readonly flow='.maestro/mb-715-livekit-user.yaml'
    [[ -n "${MAESTRO_MB_VIDEO_USER_EMAIL:-}" && -n "${MAESTRO_MB_VIDEO_USER_PASSWORD:-}" ]] || {
      echo 'Protected MB-715 USER fixture credentials are required.' >&2
      exit 1
    }
    ;;
  SPECIALIST)
    readonly flow='.maestro/mb-715-livekit-specialist.yaml'
    [[ -n "${MAESTRO_MB_VIDEO_SPECIALIST_EMAIL:-}" && -n "${MAESTRO_MB_VIDEO_SPECIALIST_PASSWORD:-}" ]] || {
      echo 'Protected MB-715 SPECIALIST fixture credentials are required.' >&2
      exit 1
    }
    ;;
  *)
    echo 'MB715_ANDROID_ROLE must be USER or SPECIALIST.' >&2
    exit 1
    ;;
esac

for variable in MB715_APK_SHA256 MB715_BACKEND_SHA MB715_PROVIDER_MODE; do
  [[ -n "${!variable:-}" ]] || {
    echo "$variable is required for exact-run provenance." >&2
    exit 1
  }
done
[[ "$MB715_APK_SHA256" =~ ^[0-9a-f]{64}$ ]] || {
  echo 'MB715_APK_SHA256 must be a complete lowercase SHA-256 digest.' >&2
  exit 1
}
[[ "$MB715_BACKEND_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'MB715_BACKEND_SHA must be a full lowercase 40-character Git SHA.' >&2
  exit 1
}
[[ "$MB715_PROVIDER_MODE" == 'approved-staging-livekit-cloud' ]] || {
  echo 'MB715_PROVIDER_MODE must be approved-staging-livekit-cloud.' >&2
  exit 1
}

device="${ANDROID_DEVICE:-}"
if [[ -z "$device" ]]; then
  mapfile -t devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  if [[ "${#devices[@]}" -ne 1 ]]; then
    echo 'Set ANDROID_DEVICE when zero or multiple Android devices are connected.' >&2
    exit 1
  fi
  device="${devices[0]}"
fi
[[ "$(adb -s "$device" get-state 2>/dev/null)" == 'device' ]] || {
  echo "Android device $device is not ready." >&2
  exit 1
}
[[ "$(adb -s "$device" shell getprop ro.kernel.qemu | tr -d '\r')" != '1' ]] || {
  echo 'MB-715 live evidence requires a physical Android device, not an emulator.' >&2
  exit 1
}
adb -s "$device" shell pm path "$package_name" >/dev/null || {
  echo 'The approved shared MentalBridge APK is not installed on the selected device.' >&2
  exit 1
}

# The role flows exercise capture and call controls, so grant the dedicated
# synthetic-test app the permissions up front. The deny/recovery scenario is a
# separate operator check and must not be inferred from this automation.
adb -s "$device" shell pm grant "$package_name" android.permission.CAMERA
adb -s "$device" shell pm grant "$package_name" android.permission.RECORD_AUDIO

mkdir -p "$evidence_dir"
readonly result_file="$evidence_dir/android-mb-715-${role,,}-ui-automation.txt"
report_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$report_dir"
}
trap cleanup EXIT

frontend_sha="${EVIDENCE_COMMIT_SHA:-}"
if [[ -z "$frontend_sha" ]]; then
  frontend_sha="$(git rev-parse HEAD)"
fi
[[ "$frontend_sha" =~ ^[0-9a-f]{40}$ ]] || {
  echo 'EVIDENCE_COMMIT_SHA must be a full lowercase 40-character Git SHA.' >&2
  exit 1
}

manufacturer="$(adb -s "$device" shell getprop ro.product.manufacturer | tr -d '\r\n')"
model="$(adb -s "$device" shell getprop ro.product.model | tr -d '\r\n')"
android_release="$(adb -s "$device" shell getprop ro.build.version.release | tr -d '\r\n')"
android_sdk="$(adb -s "$device" shell getprop ro.build.version.sdk | tr -d '\r\n')"
app_version="$(adb -s "$device" shell dumpsys package "$package_name" | awk -F= '/versionName=/{print $2; exit}' | tr -d '\r\n')"
started_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

write_result() {
  local classification="$1"
  local completed_at
  completed_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  {
    printf 'MB-715 Android result: %s\n' "$classification"
    printf 'Role: %s\n' "$role"
    printf 'Frontend SHA: %s\n' "$frontend_sha"
    printf 'Backend SHA: %s\n' "$MB715_BACKEND_SHA"
    printf 'APK SHA-256: %s\n' "$MB715_APK_SHA256"
    printf 'Provider mode: %s\n' "$MB715_PROVIDER_MODE"
    printf 'Fixture contract: %s\n' "$fixture_contract"
    printf 'Device: %s %s; Android %s (API %s)\n' \
      "$manufacturer" "$model" "$android_release" "$android_sdk"
    printf 'App version: %s\n' "${app_version:-unreported}"
    printf 'Started UTC: %s\nCompleted UTC: %s\n' "$started_at" "$completed_at"
    printf 'Automated scope: owner login, exact-role appointment navigation, local preview UI, room/remote-participant UI state, device toggles, explicit leave; USER also stop/reopen/rejoin, SPECIALIST also opens and cancels the completion review.\n'
    printf 'Evidence boundary: this result does not prove bidirectional RTP/audio, human-perceived media, Android permission denial recovery, audio-route behavior, signed webhook attendance, completion verification, credit settlement, or browser-peer evidence.\n'
    printf 'No credentials, tokens, raw provider payloads, private appointment identifiers, camera frames, or Maestro debug output are retained.\n'
  } >"$result_file"
}

if ! maestro --device "$device" test --debug-output "$report_dir" "$flow"; then
  write_result 'AUTOMATED_UI_FAIL'
  echo "MB-715 $role UI automation failed; raw Maestro output was not retained." >&2
  exit 1
fi

write_result 'AUTOMATED_UI_PASS_ONLY'
printf 'MB-715 %s UI automation passed on %s; provider/media completion remains unverified.\n' \
  "$role" "$device"
